export default function Sidebar({viewedGames, scoreLabel, scoreValue, isOpen, onToggle, onClose}) {
    const sidebarClasses = ["sidebar"]

    if (isOpen) {
        sidebarClasses.push("is-open")
    }

    return (
        <>
            <aside className={sidebarClasses.join(" ")}>
                <div className="sidebar-header">
                    <div>
                        <p className="sidebar-eyebrow">{scoreLabel}</p>
                        <h2 className="sidebar-title">{scoreValue}</h2>
                    </div>
                    <button
                        type="button"
                        className="sidebar-toggle"
                        onClick={onToggle}
                        aria-expanded={isOpen}
                        aria-controls="viewed-games-list"
                    >
                        {isOpen ? "Hide" : `Viewed Games (${viewedGames.length})`}
                    </button>
                </div>
                <div className="sidebar-list" id="viewed-games-list">
                    {viewedGames.map((game, index) => (
                        <div key={index} className="sidebar-item">
                            <span className={`sidebar-badge ${game.is_sfw ? "is-sfw" : "is-nsfw"}`}>
                                {game.is_sfw ? "SFW" : "NSFW"}
                            </span>
                            <a
                                className="sidebar-link"
                                href={`https://store.steampowered.com/app/${game.appid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <img
                                    src={game.capsule_image}
                                    alt={game.name}
                                    className="sidebar-image"
                                />
                            </a>
                        </div>
                    ))}
                </div>
            </aside>
            {isOpen && <button type="button" className="sidebar-scrim" onClick={onClose} aria-label="Close viewed games tray"></button>}
        </>
    );
}
