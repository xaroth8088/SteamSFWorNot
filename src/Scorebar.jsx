import screenfull from 'screenfull';
import fullscreenIconUrl from './full-screen-svgrepo-com.svg';

function switchToFullscreen() {
    if (screenfull.isEnabled) {
		screenfull.request();
	}
}

export default function Scorebar({scorebarState, loadedCounts, gameMode, wrongAnswers, onBack, children}) {
    const styles = ["scorebar"];

    let text = "Is this game SFW?";

    switch (scorebarState) {
        case "incorrect":
            styles.push("incorrect");
            text = "Wrong Answer";
            break;
        case "gameover":
            styles.push("incorrect");
            text = "xxxXXX Game Over XXXxxx";
            break;
        case "correct":
            styles.push("correct");
            text = "Correct!";
            break;
    }
    return (
        <div className={styles.join(" ")}>
            <button
                type="button"
                className="scorebar-nav-button"
                onClick={onBack}
                disabled={!onBack}
                aria-label="Return to start screen"
            >
                ←
            </button>
            <div className="scorebar-text">
                <div className="scorebar-title">{text}</div>
                <div className="scorebar-meta">
                    <div className="scorebar-loaded">
                        Loaded: {loadedCounts.sfw} SFW / {loadedCounts.nsfw} NSFW
                    </div>
                    <div className="scorebar-mode-label">
                        Mode: {gameMode.charAt(0).toUpperCase() + gameMode.slice(1)}
                    </div>
                    {gameMode === "normal" && (
                        <div className="strike-indicator" aria-label={`${wrongAnswers} of 3 strikes used`}>
                            {[0, 1, 2].map((index) => (
                                <span
                                    key={index}
                                    className={`strike-mark ${index < wrongAnswers ? "is-used" : ""}`}
                                    aria-hidden="true"
                                >
                                    X
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                {children}
            </div>
            <button className="fullscreen-button" onClick={switchToFullscreen}>
                <img src={fullscreenIconUrl} alt="Icon" />
            </button>
        </div>
    );
}
