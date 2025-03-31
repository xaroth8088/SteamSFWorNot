export default function Sidebar({correctGames}) {
    return (
        <div className="sidebar">
            {correctGames.map((game, index) => (
                <div key={index} className="sidebar-item">
                    <a
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
    );
}