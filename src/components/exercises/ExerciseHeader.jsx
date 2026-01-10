const ExerciseHeader = ({
  title,
  subtitle,
  currentQuestion,
  totalQuestions,
  progressPercentage,
  isBatmanMoving = false,
  isRetryMode = false,
  retryModeText = 'Retry Wrong Questions',
  showBatman = true,
  showQuestionCounter = true,
  targetInfo,
  showProgressLabel = true,
  customContent
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 md:p-5 border border-gray-200">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs md:text-sm font-medium text-gray-500 truncate mb-1">
            {isRetryMode ? retryModeText : title}
          </p>
          {subtitle && <h1 className="text-lg md:text-2xl font-bold text-gray-900">{subtitle}</h1>}
          {customContent && customContent}
        </div>
        {targetInfo && (
          <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
            <span>{targetInfo}</span>
          </div>
        )}
        {showQuestionCounter && currentQuestion !== undefined && totalQuestions !== undefined && !targetInfo && (
          <div className="text-right flex-shrink-0">
            <div className="text-xl md:text-3xl font-bold text-blue-600">
              {currentQuestion}/{totalQuestions}
            </div>
            <div className="text-xs md:text-sm text-gray-500">
              Question
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {progressPercentage !== undefined && (
        <div className="mt-4 relative">
          {showProgressLabel && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm text-gray-600">Progress</span>
              <span className="text-xs md:text-sm font-semibold text-blue-600">
                {Math.round(progressPercentage)}%
              </span>
            </div>
          )}
          <div className="w-full bg-gray-200 rounded-full h-2.5 relative overflow-visible">
            <div
              className={`h-2.5 rounded-full transition-all duration-[3000ms] ${isRetryMode ? 'bg-yellow-600' : 'bg-blue-600'}`}
              style={{
                width: `${progressPercentage}%`
              }}
            />
            {/* Running Batman Animation - moves with and stays with progress bar */}
            {showBatman && (
              <img
                src={isBatmanMoving ? "https://xpclass.vn/LMS_enhance/gif/Left%20running/batman.gif" : "https://xpclass.vn/xpclass/materials/batman_standing.gif"}
                alt="Running Batman"
                className="absolute -top-8 h-12 transition-all duration-[3000ms]"
                style={{
                  left: `calc(${progressPercentage}% - 24px)`,
                  zIndex: 10
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ExerciseHeader
