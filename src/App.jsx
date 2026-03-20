import React, {useEffect, useState} from 'react'
import Sidebar from "./Sidebar.jsx";
import Scorebar from "./Scorebar.jsx";
import Confetti from 'react-dom-confetti';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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
        return
    }

    setLoading(true)
    setShowCapsule(false)
    setDescriptionRevealed(false)
    setScorebarState("")
    setPhase("guess")

    const randomIndex = Math.floor(Math.random() * apps.length)
    const appid = apps[randomIndex]

    try {
        const url = `api/appdetails/?appids=${appid}&filter=basic`
        console.log(`Fetching ${appid} app details...`)
        const data = await fetchWithExponentialBackoff(url)

        if (!data[appid] || !data[appid].success || data[appid].data.type !== "game") {
            await loadRandomGame({
                apps,
                setCurrentGame,
                setDescriptionRevealed,
                setError,
                setLoading,
                setPhase,
                setScorebarState,
                setShowCapsule,
            })
            return
        }

        const appData = data[appid].data
        let is_sfw = true
        if (appData.content_descriptors && appData.content_descriptors.ids) {
            console.log(`Content descriptors: ${appData.content_descriptors.ids}`)
            if (
                appData.content_descriptors.ids.includes(1) ||
                appData.content_descriptors.ids.includes(3) ||
                appData.content_descriptors.ids.includes(4)
            ) {
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
    } catch (err) {
        console.error("Error fetching app details after retries:", err)
        await loadRandomGame({
            apps,
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
    const [appList, setAppList] = useState(null)
    const [loadedCounts, setLoadedCounts] = useState({sfw: 0, nsfw: 0})
    const [currentGame, setCurrentGame] = useState(null)
    const [loading, setLoading] = useState(true)
    // phases: "loading", "guess", "afterImage", "feedback", "gameover"
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
                // Fetch NSFW and SFW app lists and then merge
                let params = {
                    cc: "US",
                    flavor: "contenthub_all",
                    tabuniqueid: "3",
                    sectionuniqueid: "13268",
                    strContentHubType: "category",
                    strContentHubCategory: "singleplayer",
                    strFacetFilter: JSON.stringify({
                        type: 1,
                        rgSubexpressions: [
                            {type: 7, value: "game"},
                            {type: 5, value: 1},
                            {type: 5, value: 3},
                            {type: 5, value: 4}
                        ]
                    }),
                    count: "5000",
                    start: "0"
                }

                let queryString = new URLSearchParams(params).toString()
                let data = await fetchWithExponentialBackoff(
                    `saleaction/ajaxgetsaledynamicappquery?${queryString}`
                )
                const nsfwAppids = data.appids

                params = {
                    cc: "US",
                    flavor: "contenthub_all",
                    tabuniqueid: "3",
                    sectionuniqueid: "13268",
                    strContentHubType: "category",
                    strContentHubCategory: "singleplayer",
                    strFacetFilter: JSON.stringify({
                        type: 1,
                        rgSubexpressions: [{type: 7, value: "game"}]
                    }),
                    count: "5000",
                    start: "0"
                }
                queryString = new URLSearchParams(params).toString()
                data = await fetchWithExponentialBackoff(
                    `saleaction/ajaxgetsaledynamicappquery?${queryString}`
                )
                const sfwAppids = data.appids

                const apps = [...nsfwAppids, ...sfwAppids]
                setLoadedCounts({
                    sfw: sfwAppids.length,
                    nsfw: nsfwAppids.length
                })
                setAppList(apps)
                await loadRandomGame({
                    apps,
                    setCurrentGame,
                    setDescriptionRevealed,
                    setError,
                    setLoading,
                    setPhase,
                    setScorebarState,
                    setShowCapsule,
                })
            } catch (err) {
                console.error("Error fetching app list:", err)
                setError("Failed to load app list.")
            }
        }

        fetchAppList()
    }, [])

    const loadNewGame = async (apps = appList) => {
        await loadRandomGame({
            apps,
            setCurrentGame,
            setDescriptionRevealed,
            setError,
            setLoading,
            setPhase,
            setScorebarState,
            setShowCapsule,
        })
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

        if (!correct) {
            setScorebarState("incorrect")
            setPhase("gameover")
            return
        } else {
            let points = 0
            if (phase === "guess") {
                points = 10
            } else if (phase === "afterImage") {
                points = descriptionRevealed ? 1 : 5
            }
            setScore((prev) => prev + points)
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
        setScore(0)
        setCorrectGames([])
        setIsSidebarOpen(false)
        await loadNewGame()
    }

    let mainContent;
    let buttons;
    let panelClassName = "main-panel";
    let panelTitle = "";

    const isResultPhase = phase === "feedback" || phase === "gameover"
    const showDescription = isResultPhase || (phase === "afterImage" && descriptionRevealed)
    const showStableLayout = !loading && currentGame

    if (loading || !currentGame) {
        panelClassName += " is-loading";
        panelTitle = "Preparing a New Round";
        mainContent = (
            <div className="content-placeholder">
                <div className="placeholder-orb" aria-hidden="true"></div>
                <p className="placeholder-copy">Loading...</p>
            </div>
        )
    } else if (phase === "gameover") {
        panelClassName += " is-result";
        mainContent = null;
        buttons = (
            <button onClick={handleRestartGame}>Restart Game</button>
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
                <button className="answer-button" onClick={() => handleAnswer("yes")}>SAFE</button>
                <button className="answer-button" onClick={() => handleAnswer("no")}>NSFW</button>
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
                    <p className="round-summary">Final Score: {score}</p>
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
                score={score}
                isOpen={isSidebarOpen}
                onToggle={() => setIsSidebarOpen((prev) => !prev)}
                onClose={() => setIsSidebarOpen(false)}
            />
            <Scorebar
                scorebarState={scorebarState}
                loadedCounts={loadedCounts}
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
