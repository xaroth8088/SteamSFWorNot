import React, {useEffect, useState} from 'react'
import Sidebar from "./Sidebar.jsx";
import Scorebar from "./Scorebar.jsx";
import ConfettiImport from 'react-dom-confetti';

const Confetti = ConfettiImport.default ?? ConfettiImport
const GAME_MODES = {
    hardcore: "hardcore",
    normal: "normal",
    endless: "endless"
}
const GAME_MODE_DETAILS = {
    [GAME_MODES.hardcore]: {
        label: "Hardcore",
        title: "One mistake ends the run",
    },
    [GAME_MODES.normal]: {
        label: "Normal",
        title: "Three strikes and you're out",
    },
    [GAME_MODES.endless]: {
        label: "Endless",
        title: "Play forever, track accuracy",
    }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const ADULT_CONTENT_DESCRIPTOR_IDS = [1, 3, 4]
const SALE_QUERY_PAGE_SIZE = 5000

function decodeHtml(html) {
    const textarea = document.createElement('textarea')
    textarea.innerHTML = html
    return textarea.value
}

async function fetchWithExponentialBackoff(url, retries = 5, delay = 500) {
    const noCorsUrl = `https://steam-proxy.xaroth-733.workers.dev/${url}`
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(noCorsUrl, {
                method: 'GET',
                credentials: 'omit'
            })
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            return await response.json()
        } catch (err) {
            if (i === retries - 1) {
                throw err
            }
            await sleep(delay)
            delay *= 2
        }
    }
}

function buildSaleQueryParams(rgSubexpressions, start = 0) {
    return {
        cc: "US",
        flavor: "contenthub_all",
        tabuniqueid: "3",
        sectionuniqueid: "13268",
        strContentHubType: "category",
        strContentHubCategory: "singleplayer",
        strFacetFilter: JSON.stringify({
            type: 1,
            rgSubexpressions
        }),
        count: String(SALE_QUERY_PAGE_SIZE),
        start: String(start)
    }
}

async function fetchSaleQueryAppIds(rgSubexpressions, start = 0) {
    const queryString = new URLSearchParams(buildSaleQueryParams(rgSubexpressions, start)).toString()
    const data = await fetchWithExponentialBackoff(
        `saleaction/ajaxgetsaledynamicappquery?${queryString}`
    )
    return data.appids ?? []
}

async function fetchBalancedAppPool() {
    const gameFilter = [{type: 7, value: "game"}]
    const nsfwAppids = await fetchSaleQueryAppIds([
        ...gameFilter,
        ...ADULT_CONTENT_DESCRIPTOR_IDS.map((value) => ({type: 5, value}))
    ])
    const nsfwUniqueAppids = Array.from(new Set(nsfwAppids))
    const nsfwSet = new Set(nsfwUniqueAppids)
    const sfwSet = new Set()

    for (let start = 0; sfwSet.size < nsfwSet.size; start += SALE_QUERY_PAGE_SIZE) {
        const appids = await fetchSaleQueryAppIds(gameFilter, start)
        if (appids.length === 0) {
            break
        }

        for (const appid of appids) {
            if (!nsfwSet.has(appid)) {
                sfwSet.add(appid)
            }
        }

        if (appids.length < SALE_QUERY_PAGE_SIZE) {
            break
        }
    }

    const balancedCount = Math.min(nsfwUniqueAppids.length, sfwSet.size)
    const sfwAppids = Array.from(sfwSet).slice(0, balancedCount)
    const nsfwBalancedAppids = nsfwUniqueAppids.slice(0, balancedCount)

    return {
        apps: [...nsfwBalancedAppids, ...sfwAppids],
        counts: {
            sfw: sfwAppids.length,
            nsfw: nsfwBalancedAppids.length
        }
    }
}

async function loadRandomGame({
    apps,
    setCurrentGame,
    setDescriptionRevealed,
    setError,
    setLoading,
    setPhase,
    setScorebarState,
    setShowCapsule,
}) {
    if (!apps || apps.length === 0) {
        setError("No apps available.")
        setCurrentGame(null)
        setLoading(false)
        return []
    }

    setLoading(true)
    setShowCapsule(false)
    setDescriptionRevealed(false)
    setScorebarState("")
    setPhase("guess")

    const randomIndex = Math.floor(Math.random() * apps.length)
    const appid = apps[randomIndex]
    const remainingApps = apps.filter((_, index) => index !== randomIndex)

    try {
        const url = `api/appdetails/?appids=${appid}&filter=basic`
        console.log(`Fetching ${appid} app details...`)
        const data = await fetchWithExponentialBackoff(url)

        if (!data[appid] || !data[appid].success || data[appid].data.type !== "game") {
            return await loadRandomGame({
                apps: remainingApps,
                setCurrentGame,
                setDescriptionRevealed,
                setError,
                setLoading,
                setPhase,
                setScorebarState,
                setShowCapsule,
            })
        }

        const appData = data[appid].data
        let is_sfw = true
        if (appData.content_descriptors && appData.content_descriptors.ids) {
            console.log(`Content descriptors: ${appData.content_descriptors.ids}`)
            if (ADULT_CONTENT_DESCRIPTOR_IDS.some((id) => appData.content_descriptors.ids.includes(id))) {
                is_sfw = false
            }
        }
        setCurrentGame({
            appid,
            name: appData.name,
            capsule_image: appData.capsule_image,
            short_description: decodeHtml(appData.short_description),
            is_sfw
        })
        setLoading(false)
        return remainingApps
    } catch (err) {
        console.error("Error fetching app details after retries:", err)
        return await loadRandomGame({
            apps: remainingApps,
            setCurrentGame,
            setDescriptionRevealed,
            setError,
            setLoading,
            setPhase,
            setScorebarState,
            setShowCapsule,
        })
    }
}

function App() {
    const [score, setScore] = useState(0)
    const [gameMode, setGameMode] = useState(GAME_MODES.hardcore)
    const [wrongAnswers, setWrongAnswers] = useState(0)
    const [correctAnswers, setCorrectAnswers] = useState(0)
    const [totalAnswers, setTotalAnswers] = useState(0)
    const [appList, setAppList] = useState(null)
    const [remainingApps, setRemainingApps] = useState([])
    const [loadedCounts, setLoadedCounts] = useState({sfw: 0, nsfw: 0})
    const [currentGame, setCurrentGame] = useState(null)
    const [loading, setLoading] = useState(true)
    // phases: "loading", "start", "guess", "afterImage", "feedback", "gameover"
    const [phase, setPhase] = useState("loading")
    const [scorebarState, setScorebarState] = useState("")
    const [showCapsule, setShowCapsule] = useState(false)
    const [descriptionRevealed, setDescriptionRevealed] = useState(false)
    const [, setError] = useState("")
    // List of games correctly answered (most recent first)
    const [correctGames, setCorrectGames] = useState([])
    const [isExploding, setIsExploding] = React.useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    useEffect(() => {
        async function fetchAppList() {
            try {
                const {apps, counts} = await fetchBalancedAppPool()
                setLoadedCounts(counts)
                setAppList(apps)
                setRemainingApps(apps)
                setCurrentGame(null)
                setLoading(false)
                setPhase("start")
            } catch (err) {
                console.error("Error fetching app list:", err)
                setError("Failed to load app list.")
            }
        }

        fetchAppList()
    }, [])

    const loadNewGame = async (apps = remainingApps) => {
        const nextRemainingApps = await loadRandomGame({
            apps,
            setCurrentGame,
            setDescriptionRevealed,
            setError,
            setLoading,
            setPhase,
            setScorebarState,
            setShowCapsule,
        })
        setRemainingApps(nextRemainingApps)
    }

    const resetRunState = () => {
        setScore(0)
        setWrongAnswers(0)
        setCorrectAnswers(0)
        setTotalAnswers(0)
        setCorrectGames([])
        setScorebarState("")
        setIsExploding(false)
        setIsSidebarOpen(false)
    }

    const returnToStartScreen = () => {
        resetRunState()
        setCurrentGame(null)
        setLoading(false)
        setPhase("start")
    }

    const handleStartGame = async () => {
        resetRunState()
        await loadNewGame(appList)
    }

    const handleDontKnow = () => {
        if (phase === "guess") {
            setShowCapsule(true)
            setPhase("afterImage")
        } else if (phase === "afterImage" && !descriptionRevealed) {
            setDescriptionRevealed(true)
        }
    }

    const handleAnswer = (answer) => {
        if (!currentGame) return

        let correct = false
        if (answer === "yes") {
            correct = currentGame.is_sfw
        } else if (answer === "no") {
            correct = !currentGame.is_sfw
        }

        setTotalAnswers((prev) => prev + 1)

        if (!correct) {
            if (gameMode === GAME_MODES.endless) {
                setScorebarState("incorrect")
                setPhase("feedback")
                return
            }

            if (gameMode === GAME_MODES.normal) {
                const nextWrongAnswers = wrongAnswers + 1
                setWrongAnswers(nextWrongAnswers)
                if (nextWrongAnswers >= 3) {
                    setScorebarState("gameover")
                    setPhase("gameover")
                    return
                }
                setScorebarState("incorrect")
                setPhase("feedback")
                return
            }

            setScorebarState("gameover")
            setPhase("gameover")
            return
        } else {
            setCorrectAnswers((prev) => prev + 1)
            let points = 0
            if (gameMode !== GAME_MODES.endless) {
                if (phase === "guess") {
                    points = 10
                } else if (phase === "afterImage") {
                    points = descriptionRevealed ? 1 : 5
                }
                setScore((prev) => prev + points)
            }
            setScorebarState("correct")
            setPhase("feedback")
            setCorrectGames((prev) => [currentGame, ...prev])
            setIsExploding(true);
        }
    }

    const handleNextGame = async () => {
        setIsExploding(false);
        setIsSidebarOpen(false)
        await loadNewGame()
    }

    const handleRestartGame = async () => {
        returnToStartScreen()
    }

    const handleSelectMode = (nextMode) => {
        if (nextMode === gameMode) {
            return
        }

        setGameMode(nextMode)
        resetRunState()
    }

    const accuracyPercent = totalAnswers > 0
        ? Math.round((correctAnswers / totalAnswers) * 100)
        : 0
    const scoreLabel = gameMode === GAME_MODES.endless ? "Accuracy" : "Current Score"
    const scoreValue = gameMode === GAME_MODES.endless ? `${accuracyPercent}%` : score
    const finalSummaryLabel = gameMode === GAME_MODES.endless ? "Accuracy" : "Final Score"

    let mainContent;
    let buttons;
    let panelClassName = "main-panel";
    let panelTitle = "";

    const isResultPhase = phase === "feedback" || phase === "gameover"
    const showDescription = isResultPhase || (phase === "afterImage" && descriptionRevealed)
    const showStableLayout = !loading && currentGame

    if (loading) {
        panelClassName += " is-loading";
        panelTitle = "Preparing a New Round";
        mainContent = (
            <div className="content-placeholder">
                <div className="placeholder-orb" aria-hidden="true"></div>
                <p className="placeholder-copy">Loading...</p>
            </div>
        )
    } else if (phase === "start") {
        panelClassName += " is-start";
        mainContent = (
            <div className="mode-select">
                <div className="start-logo" aria-label="Steam SFW or Not">
                    <span className="start-logo-kicker">Steam</span>
                    <h1 className="start-logo-title">
                        <span className="start-logo-safe">SFW</span>
                        <span className="start-logo-divider">or</span>
                        <span className="start-logo-risky">Not</span>
                    </h1>
                </div>
                <p className="start-copy">Office-safe game or HR violation? Separate safe from suspect.</p>
                <div className="mode-grid">
                    {Object.values(GAME_MODES).map((mode) => {
                        const modeDetails = GAME_MODE_DETAILS[mode]
                        return (
                            <button
                                key={mode}
                                type="button"
                                className={`mode-card ${gameMode === mode ? "is-active" : ""}`}
                                onClick={() => handleSelectMode(mode)}
                                aria-pressed={gameMode === mode}
                            >
                                <span className="mode-card-label">{modeDetails.label}</span>
                                <span className="mode-card-title">{modeDetails.title}</span>
                            </button>
                        )
                    })}
                </div>
            </div>
        );
        buttons = (
            <button onClick={handleStartGame}>Start Game</button>
        );
    } else if (phase === "gameover") {
        panelClassName += " is-result";
        mainContent = null;
        buttons = (
            <button onClick={handleRestartGame}>Return to Start</button>
        );
    } else if (phase === "feedback") {
        panelClassName += " is-result";
        mainContent = null;
        buttons = (
            <button onClick={handleNextGame}>Next Game</button>
        );
    } else {
        // phase "guess" or "afterImage"
        panelClassName += " is-guessing";
        mainContent = null;
        buttons = (
            <>
                <button className="answer-button answer-button-safe" onClick={() => handleAnswer("yes")}>SAFE</button>
                <button className="answer-button answer-button-nsfw" onClick={() => handleAnswer("no")}>NSFW</button>
                {(phase === "guess" ||
                    (phase === "afterImage" && !descriptionRevealed)) && (
                    <button className="hint-button" onClick={handleDontKnow}>I don&#39;t know</button>
                )}
            </>
        );
    }

    if (showStableLayout) {
        mainContent = (
            <>
                {phase === "gameover" && (
                    <p className="round-summary">{finalSummaryLabel}: {scoreValue}</p>
                )}
                <h3 className="game-title">{currentGame.name}</h3>
                <div className={`capsule-slot ${showCapsule || isResultPhase ? "is-revealed" : "is-concealed"}`}>
                    {showCapsule || isResultPhase ? (
                        currentGame.capsule_image ? (
                            <div className="capsule-frame">
                                <a
                                    href={`https://store.steampowered.com/app/${currentGame.appid}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <img
                                        src={currentGame.capsule_image}
                                        alt="Capsule"
                                        className="capsule-image"
                                    />
                                </a>
                            </div>
                        ) : (
                            <div className="capsule-frame capsule-frame-empty" aria-hidden="true">
                                <div className="placeholder-card">
                                    <span></span>
                                </div>
                            </div>
                        )
                    ) : (
                        <div className="capsule-frame capsule-frame-muted">
                            <div className="placeholder-card">
                                <div className="capsule-placeholder-copy">
                                    Press &quot;I don&apos;t know&quot; to reveal the store capsule
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className={`description-slot ${showDescription ? "is-revealed" : "is-concealed"}`}>
                    {showDescription ? (
                        currentGame.short_description ? (
                            <p className="description">{currentGame.short_description}</p>
                        ) : (
                            <div className="description description-empty" aria-hidden="true"></div>
                        )
                    ) : (
                        <div className="description description-muted">
                            <p className={`description-blur-line description-helper ${showCapsule ? "is-readable" : ""}`}>Use another hint to reveal the full summary</p>
                        </div>
                    )}
                </div>
            </>
        )
    }

    return (
        <>
            <Sidebar
                correctGames={correctGames}
                scoreLabel={scoreLabel}
                scoreValue={scoreValue}
                isOpen={isSidebarOpen}
                onToggle={() => setIsSidebarOpen((prev) => !prev)}
                onClose={() => setIsSidebarOpen(false)}
            />
            <Scorebar
                scorebarState={scorebarState}
                loadedCounts={loadedCounts}
                gameMode={gameMode}
                wrongAnswers={wrongAnswers}
                onBack={phase === "start" || phase === "loading" ? null : returnToStartScreen}
            >
                <div className="confetti-container">
                    <Confetti active={isExploding} config={{
                        angle: 90,
                        spread: 360,
                        startVelocity: 30,
                        elementCount: 70,
                        dragFriction: 0.12,
                        duration: 3000,
                        stagger: 3,
                        width: "10px",
                        height: "10px",
                        perspective: "500px",
                        colors: ["#a864fd", "#29cdff", "#78ff44", "#ff718d", "#fdff6a"]
                    }}/>
                </div>
            </Scorebar>
            <div className="main-content">
                <section className="main-stage">
                    <div className={panelClassName}>
                        {panelTitle && (
                            <div className="panel-header">
                                <h1 className="panel-title">{panelTitle}</h1>
                            </div>
                        )}
                        <div className="panel-body">
                            {mainContent}
                        </div>
                    </div>
                </section>
            </div>
            <div className="button-group">{buttons}</div>
        </>
    )
}

export default App
