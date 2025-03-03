import React, {useEffect, useState} from 'react'

function App() {
    const [score, setScore] = useState(0)
    const [appList, setAppList] = useState(null)
    const [currentGame, setCurrentGame] = useState(null)
    const [loading, setLoading] = useState(true)
    // phases: "loading", "guess", "afterImage", "feedback", "gameover"
    const [phase, setPhase] = useState("loading")
    const [feedback, setFeedback] = useState("")
    const [showCapsule, setShowCapsule] = useState(false)
    const [descriptionRevealed, setDescriptionRevealed] = useState(false)
    const [error, setError] = useState("")
    // List of games correctly answered (most recent first)
    const [correctGames, setCorrectGames] = useState([])

    // Helper function: sleep for a given number of milliseconds
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

    // Helper function: HTML entity decode
    function decodeHtml(html) {
        const textarea = document.createElement('textarea')
        textarea.innerHTML = html
        return textarea.value
    }

    // Helper function: fetch with exponential back-off
    const fetchWithExponentialBackoff = async (url, retries = 5, delay = 500) => {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, {
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

    // Fetch and cache the full app list on mount
    useEffect(() => {
        async function fetchAppList() {
            try {
                // This gets ONLY NSFW results
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
                const nsfwResponse = await fetch(
                    `/store/saleaction/ajaxgetsaledynamicappquery?${queryString}`
                )
                let data = await nsfwResponse.json()
                const nsfwAppids = data.appids

                // This gets ALL results
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
                const sfwResponse = await fetch(
                    `/store/saleaction/ajaxgetsaledynamicappquery?${queryString}`
                )
                data = await sfwResponse.json()
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

    // Function to load a new game round
    const loadNewGame = async (apps = appList) => {
        if (!apps || apps.length === 0) {
            setError("No apps available.")
            return
        }
        // Reset state for a new round
        setLoading(true)
        setShowCapsule(false)
        setDescriptionRevealed(false)
        setFeedback("")
        setPhase("guess")

        // Randomly select an app from the list
        const randomIndex = Math.floor(Math.random() * apps.length)
        const appid = apps[randomIndex]
        try {
            const url = `/store/api/appdetails/?appids=${appid}&filter=basic`
            console.log(`Fetching ${appid} app details...`)
            const data = await fetchWithExponentialBackoff(url)

            // If the data is missing, unsuccessful, or not a game, try another game
            if (!data[appid] || !data[appid].success || data[appid].data.type !== "game") {
                await loadNewGame(apps)
                return
            }

            // Example mapping:
            // 1: NudityOrSexualContent
            // 2: FrequentViolenceOrGore
            // 3: AdultOnlySexualContent
            // 4: GratuitousNudityOrSexualContent
            // 5: GeneralMatureContent

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

    // Handler for the "I don't know" button:
    // In "guess" phase, it shows the capsule image and switches to "afterImage".
    // In "afterImage" phase, if the description hasn't been revealed, it reveals it.
    const handleDontKnow = () => {
        if (phase === "guess") {
            setShowCapsule(true)
            setPhase("afterImage")
        } else if (phase === "afterImage" && !descriptionRevealed) {
            setDescriptionRevealed(true)
        }
    }

    // Handle answer for Yes/No buttons
    const handleAnswer = (answer) => {
        if (!currentGame) return

        let correct = false
        if (answer === "yes") {
            correct = currentGame.is_sfw
        } else if (answer === "no") {
            correct = !currentGame.is_sfw
        }

        if (!correct) {
            // End the game on an incorrect answer.
            setFeedback("Incorrect! Game Over!")
            setPhase("gameover")
            return
        } else {
            // Correct answer: update score and add the game to the sidebar list
            let points = 0
            if (phase === "guess") {
                points = 10
            } else if (phase === "afterImage") {
                points = descriptionRevealed ? 1 : 5
            }
            setScore((prev) => prev + points)
            setFeedback(`Correct! You gained ${points} points.`)
            setPhase("feedback")
            // Add current game to the list of correctly answered games (most recent at the top)
            setCorrectGames((prev) => [currentGame, ...prev])
        }
    }

    // Start the next round (only available after a correct answer)
    const handleNextGame = async () => {
        await loadNewGame()
    }

    // Restart game after game over, resetting score and sidebar list
    const handleRestartGame = async () => {
        setScore(0)
        setCorrectGames([])
        await loadNewGame()
    }

    // Define styles for the sidebar and main content
    const sidebarStyle = {
        width: "200px",
        maxHeight: "100vh",
        overflowY: "auto",
        borderRight: "1px solid #ccc",
        padding: "1rem"
    }

    const mainContentStyle = {
        flex: 1,
        padding: "1rem"
    }

    // Determine what to show in the main content area
    let mainContent
    if (loading || !currentGame) {
        mainContent = <div style={{textAlign: "center", marginTop: "2rem"}}>Loading...</div>
    } else if (phase === "gameover") {
        mainContent = (
            <div style={{textAlign: "center", marginTop: "2rem"}}>
                <h1>{feedback}</h1>
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
                                style={{maxWidth: "300px", margin: "1rem"}}
                            />
                        </a>
                    </div>
                )}
                {currentGame.short_description && (
                    <p style={{margin: "1rem"}}>{currentGame.short_description}</p>
                )}
                <button onClick={handleRestartGame}>Restart Game</button>
            </div>
        )
    } else if (phase === "feedback") {
        mainContent = (
            <div style={{textAlign: "center", marginTop: "2rem"}}>
                <h1>{feedback}</h1>
                <h2>Score: {score}</h2>
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
                                style={{maxWidth: "300px", margin: "1rem"}}
                            />
                        </a>
                    </div>
                )}
                {currentGame.short_description && (
                    <p style={{margin: "1rem"}}>{currentGame.short_description}</p>
                )}
                <button onClick={handleNextGame}>Next Game</button>
            </div>
        )
    } else {
        // phase "guess" or "afterImage"
        mainContent = (
            <div style={{textAlign: "center", marginTop: "2rem"}}>
                <h1>Is this game SFW?</h1>
                <h2>Score: {score}</h2>
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
                                style={{maxWidth: "300px", margin: "1rem"}}
                            />
                        </a>
                    </div>
                )}
                {phase === "afterImage" &&
                    descriptionRevealed &&
                    currentGame.short_description && (
                        <p style={{margin: "1rem"}}>{currentGame.short_description}</p>
                    )}
                <div style={{marginTop: "1rem"}}>
                    <button onClick={() => handleAnswer("yes")}>Yes</button>
                    <button onClick={() => handleAnswer("no")}>No</button>
                    {(phase === "guess" ||
                        (phase === "afterImage" && !descriptionRevealed)) && (
                        <button onClick={handleDontKnow}>I don&#39;t know</button>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div style={{display: "flex"}}>
            {/* Sidebar with correctly answered games */}
            <div style={sidebarStyle}>
                {correctGames.map((game, index) => (
                    <div key={index} style={{marginBottom: "1rem"}}>
                        <a
                            href={`https://store.steampowered.com/app/${game.appid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <img src={game.capsule_image} alt={game.name} style={{width: "100%"}}/>
                        </a>
                    </div>
                ))}
            </div>

            {/* Main game content */}
            <div style={mainContentStyle}>{mainContent}</div>
        </div>
    )
}

export default App
