import screenfull from 'screenfull';
import fullscreenIconUrl from './full-screen-svgrepo-com.svg';

function switchToFullscreen() {
    if (screenfull.isEnabled) {
		screenfull.request();
	}
}

export default function Scorebar({scorebarState, loadedCounts, children}) {
    const styles = ["scorebar"];

    let text = "Is this game SFW?";

    switch (scorebarState) {
        case "incorrect":
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
            <div className="scorebar-text">
                <div className="scorebar-title">{text}</div>
                <div className="scorebar-loaded">
                    Loaded: {loadedCounts.sfw} SFW / {loadedCounts.nsfw} NSFW
                </div>
                {children}
            </div>
            <button className="fullscreen-button" onClick={switchToFullscreen}>
                <img src={fullscreenIconUrl} alt="Icon" />
            </button>
        </div>
    );
}
