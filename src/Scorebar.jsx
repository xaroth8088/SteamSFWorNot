export default function Scorebar({scorebarState, score}) {
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
            <div className="scorebar-text">{text}</div>
            <div className="scorebar-score">
                Score: {score}
            </div>
        </div>
    );
}