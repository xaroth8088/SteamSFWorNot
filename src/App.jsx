import React, {useEffect, useState} from 'react'
import Sidebar from "./Sidebar.jsx";
import Scorebar from "./Scorebar.jsx";
import Confetti from 'react-dom-confetti';

function App() {
    const [score, setScore] = useState(0)
    const [appList, setAppList] = useState(null)
    const [currentGame, setCurrentGame] = useState(null)
    const [loading, setLoading] = useState(true)
    // phases: "loading", "guess", "afterImage", "feedback", "gameover"
    const [phase, setPhase] = useState("loading")
    const [scorebarState, setScorebarState] = useState("")
    const [showCapsule, setShowCapsule] = useState(false)
    const [descriptionRevealed, setDescriptionRevealed] = useState(false)
    const [error, setError] = useState("")
    // List of games correctly answered (most recent first)
    const [correctGames, setCorrectGames] = useState([])
    const [isExploding, setIsExploding] = React.useState(false);

    // Helper functions…
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

    function decodeHtml(html) {
        const textarea = document.createElement('textarea')
        textarea.innerHTML = html
        return textarea.value
    }

    const fetchWithExponentialBackoff = async (url, retries = 5, delay = 500) => {
        const noCorsUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
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
                    `https://store.steampowered.com/saleaction/ajaxgetsaledynamicappquery?${queryString}`
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
                    `https://store.steampowered.com/saleaction/ajaxgetsaledynamicappquery?${queryString}`
                )
                const sfwAppids = data.appids

                const apps = [...nsfwAppids, ...sfwAppids]
                setAppList(apps)
                await loadNewGame(apps)
            } catch (err) {
                console.error("Error fetching app list:", err)
                setError("Failed to load app list.")
            }
        }

        fetchAppList()
    }, [])

    const loadNewGame = async (apps = appList) => {
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
            const url = `https://store.steampowered.com/api/appdetails/?appids=${appid}&filter=basic`
            console.log(`Fetching ${appid} app details...`)
            const data = await fetchWithExponentialBackoff(url)

            if (!data[appid] || !data[appid].success || data[appid].data.type !== "game") {
                await loadNewGame(apps)
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
            await loadNewGame(apps)
        }
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
        await loadNewGame()
    }

    const handleRestartGame = async () => {
        setScore(0)
        setCorrectGames([])
        await loadNewGame()
    }

    let mainContent;
    let buttons;

    if (loading || !currentGame) {
        mainContent = (
            <>
                Loading...
            </>
        )
    } else if (phase === "gameover") {
        mainContent = (
            <>
                <h2>Final Score: {score}</h2>
                <h3>{currentGame.name}</h3>
                {currentGame.capsule_image && (
                    <div>
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
                )}
                {currentGame.short_description && (
                    <p className="description">{currentGame.short_description}</p>
                )}
            </>
        );
        buttons = (
            <button onClick={handleRestartGame}>Restart Game</button>
        );
    } else if (phase === "feedback") {
        mainContent = (
            <>
                <h3>{currentGame.name}</h3>
                {currentGame.capsule_image && (
                    <div>
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
                )}
                {currentGame.short_description && (
                    <p className="description">{currentGame.short_description}</p>
                )}
            </>
        );
        buttons = (
            <button onClick={handleNextGame}>Next Game</button>
        );
    } else {
        // phase "guess" or "afterImage"
        mainContent = (
            <>
                <h3>{currentGame.name}</h3>
                {showCapsule && currentGame.capsule_image && (
                    <div>
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
                )}
                {phase === "afterImage" &&
                    descriptionRevealed &&
                    currentGame.short_description && (
                        <p className="description">{currentGame.short_description}</p>
                    )}
            </>
        );
        buttons = (
            <>
                <button onClick={() => handleAnswer("yes")}>Yes</button>
                <button onClick={() => handleAnswer("no")}>No</button>
                {(phase === "guess" ||
                    (phase === "afterImage" && !descriptionRevealed)) && (
                    <button onClick={handleDontKnow}>I don&#39;t know</button>
                )}
            </>
        );
    }

    return (
        <>
            <Sidebar correctGames={correctGames}/>
            <Scorebar scorebarState={scorebarState} score={score}>
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
                {mainContent}
            </div>
            <div className="button-group">{buttons}</div>
        </>
    )
}

export default App