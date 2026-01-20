import { CheckCircle, XCircle, RotateCcw, Star } from "lucide-react";
import Button3D from "../ui/Button3D";

const CelebrationScreen = ({
  score,
  correctAnswers,
  totalQuestions,
  passThreshold = 80,
  xpAwarded = 0,
  passGif,
  isRetryMode = false,
  wrongQuestionsCount = 0,
  onRetryWrongQuestions,
  onBackToList,
  backButtonText = "Quay lại danh sách bài tập",
}) => {
  const passed = score >= passThreshold;

  // Get star count based on score: 95-100 = 3 stars, 90-95 = 2 stars, passed = 1 star
  const getStarCount = () => {
    if (!passed) return 0;
    if (score >= 95) return 3;
    if (score >= 90) return 2;
    return 1;
  };

  const starCount = getStarCount();

  // Render stars
  const renderStars = () => {
    if (starCount === 0) return null;
    return (
      <div className="flex items-center justify-center gap-1 mb-4">
        {[1, 2, 3].map((i) => (
          <Star
            key={i}
            className={`w-12 h-12 md:w-10 md:h-10 ${
              i <= starCount
                ? "text-yellow-400 fill-yellow-400"
                : "text-gray-300"
            }`}
          />
        ))}
      </div>
    );
  };

  // Retry mode completion screen
  if (isRetryMode) {
    const allCorrect = correctAnswers === totalQuestions;
    return (
      <div className="bg-white rounded-lg shadow-md p-4 md:p-8 text-center border border-gray-200">
        <div className="mb-4">
          <div
            className={`w-16 h-16 md:w-20 md:h-20 mx-auto mb-3 ${allCorrect ? "bg-green-100" : "bg-orange-100"} rounded-full flex items-center justify-center`}
          >
            {allCorrect ? (
              <CheckCircle className="w-8 h-8 md:w-10 md:h-10 text-green-500" />
            ) : (
              <XCircle className="w-8 h-8 md:w-10 md:h-10 text-orange-500" />
            )}
          </div>
          <h2
            className={`text-lg md:text-2xl font-bold mb-2 ${allCorrect ? "text-green-800" : "text-orange-800"}`}
          >
            {allCorrect ? "Đã hoàn thành ôn lại!" : "Cần cải thiện thêm!"}
          </h2>
          <p className="text-sm md:text-base text-gray-600 mb-2">
            Bạn đã trả lời đúng {correctAnswers}/{totalQuestions} câu ôn lại (
            {score}%)
          </p>
          {!allCorrect && (
            <p className="text-sm md:text-base text-orange-600 font-semibold mb-3">
              Hãy tiếp tục luyện tập để cải thiện!
            </p>
          )}
        </div>

        <div className="space-y-4">
          <Button3D
            onClick={onBackToList}
            color="blue"
            size="md"
            fullWidth={true}
            className="flex items-center justify-center"
          >
            {backButtonText}
          </Button3D>
        </div>
      </div>
    );
  }

  // Normal mode completion screen
  return (
    <div className="bg-white rounded-lg shadow-md p-4 md:p-8 text-center border border-gray-200">
      <div className="mb-4">

        {/* Title at top */}
        <h2
          className={`text-3xl md:text-2xl font-bold mb-2 ${passed ? "text-blue-600" : "text-orange-800"}`}
        >
          {passed ? "Tuyệt vời!" : "Cần cải thiện!"}
        </h2>

        {/* Stars under title */}
        {renderStars()}

        {/* Show celebration GIF if passed */}
        {passed && passGif && (
          <div className="mb-4">
            <img
              src={passGif}
              alt="Celebration"
              className="mx-auto rounded-lg shadow-lg"
              style={{ maxWidth: "300px", width: "100%", height: "auto" }}
            />
          </div>
        )}

        <p className="text-sm md:text-base text-gray-600 mb-2">
          Bạn đã trả lời đúng {correctAnswers}/{totalQuestions} câu ({score}%)
        </p>
        {!passed && (
          <p className="text-sm md:text-base text-orange-600 font-semibold mb-3">
            Cần đạt ít nhất {passThreshold}% để hoàn thành bài tập
          </p>
        )}
        {xpAwarded > 0 && (
          <div className="flex items-center justify-center space-x-2 text-yellow-600 font-semibold text-sm md:text-base">
            <Star className="w-4 h-4 md:w-5 md:h-5" />
            <span>+{xpAwarded} XP earned!</span>
          </div>
        )}
        {xpAwarded === 0 && !passed && (
          <div className="flex items-center justify-center space-x-2 text-gray-500 text-sm md:text-base">
            <XCircle className="w-4 h-4 md:w-5 md:h-5" />
            <span>Không nhận được XP (điểm quá thấp)</span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Show wrong questions retry button */}
        {wrongQuestionsCount > 0 && onRetryWrongQuestions && (
          <button
            onClick={onRetryWrongQuestions}
            className="w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium flex items-center justify-center"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Ôn lại {wrongQuestionsCount} câu sai
          </button>
        )}

        {/* Back to exercise list */}
        <Button3D
          onClick={onBackToList}
          color="blue"
          size="md"
          fullWidth={true}
          className="flex items-center justify-center"
        >
          {backButtonText}
        </Button3D>
      </div>
    </div>
  );
};

export default CelebrationScreen;
