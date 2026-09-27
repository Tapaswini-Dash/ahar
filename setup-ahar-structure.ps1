$ErrorActionPreference = "Stop"

function Ensure-Directory {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
        Write-Host "Created folder: $Path"
    }
    else {
        Write-Host "Kept existing folder: $Path"
    }
}

function Ensure-File {
    param(
        [string]$Path,
        [string]$Content = ""
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        $parent = Split-Path -Parent $Path

        if ($parent) {
            Ensure-Directory $parent
        }

        Set-Content -LiteralPath $Path -Value $Content -Encoding UTF8
        Write-Host "Created file: $Path"
    }
    else {
        Write-Host "Skipped existing file: $Path"
    }
}

$root = (Get-Location).Path

Write-Host ""
Write-Host "Setting up Ahar project structure in:"
Write-Host $root
Write-Host ""

# Safety confirmation: this script expects existing frontend and backend folders.
if (-not (Test-Path -LiteralPath (Join-Path $root "frontend"))) {
    throw "Safety stop: no 'frontend' folder found. Open the Ahar root folder, then run again."
}

if (-not (Test-Path -LiteralPath (Join-Path $root "backend"))) {
    throw "Safety stop: no 'backend' folder found. Create/open the Ahar root containing both frontend and backend."
}

# ==========================================================
# Backend directories
# ==========================================================

$backendDirectories = @(
    "backend/app",
    "backend/app/core",
    "backend/app/api",
    "backend/app/api/routes",
    "backend/app/models",
    "backend/app/schemas",
    "backend/app/services",
    "backend/app/ml",
    "backend/app/ml/artifacts",
    "backend/app/data",
    "backend/app/data/indb",
    "backend/app/data/seed",
    "backend/app/utils",
    "backend/app/tests",
    "backend/alembic",
    "backend/alembic/versions",
    "backend/scripts",
    "backend/uploads",
    "docs"
)

foreach ($directory in $backendDirectories) {
    Ensure-Directory (Join-Path $root $directory)
}

# ==========================================================
# Python packages
# ==========================================================

$pythonInitFiles = @(
    "backend/app/__init__.py",
    "backend/app/core/__init__.py",
    "backend/app/api/__init__.py",
    "backend/app/api/routes/__init__.py",
    "backend/app/models/__init__.py",
    "backend/app/schemas/__init__.py",
    "backend/app/services/__init__.py",
    "backend/app/ml/__init__.py",
    "backend/app/utils/__init__.py",
    "backend/app/tests/__init__.py"
)

foreach ($file in $pythonInitFiles) {
    Ensure-File (Join-Path $root $file)
}

# ==========================================================
# Backend placeholder files
# ==========================================================

$backendFiles = @(
    "backend/app/main.py",

    "backend/app/core/config.py",
    "backend/app/core/database.py",
    "backend/app/core/security.py",
    "backend/app/core/dependencies.py",
    "backend/app/core/logging.py",

    "backend/app/api/router.py",
    "backend/app/api/routes/health.py",
    "backend/app/api/routes/auth.py",
    "backend/app/api/routes/users.py",
    "backend/app/api/routes/onboarding.py",
    "backend/app/api/routes/food_analysis.py",
    "backend/app/api/routes/packaged_food.py",
    "backend/app/api/routes/meal_logs.py",
    "backend/app/api/routes/nutrition.py",
    "backend/app/api/routes/progress.py",
    "backend/app/api/routes/gamification.py",
    "backend/app/api/routes/assistant.py",

    "backend/app/models/base.py",
    "backend/app/models/user.py",
    "backend/app/models/user_profile.py",
    "backend/app/models/food_analysis.py",
    "backend/app/models/meal_log.py",
    "backend/app/models/meal_ingredient.py",
    "backend/app/models/packaged_food_log.py",
    "backend/app/models/daily_progress.py",
    "backend/app/models/user_gamification.py",
    "backend/app/models/badge.py",
    "backend/app/models/reminder.py",

    "backend/app/schemas/auth.py",
    "backend/app/schemas/user.py",
    "backend/app/schemas/onboarding.py",
    "backend/app/schemas/food_analysis.py",
    "backend/app/schemas/packaged_food.py",
    "backend/app/schemas/nutrition.py",
    "backend/app/schemas/meal_log.py",
    "backend/app/schemas/progress.py",
    "backend/app/schemas/gamification.py",
    "backend/app/schemas/assistant.py",

    "backend/app/services/auth_service.py",
    "backend/app/services/user_service.py",
    "backend/app/services/onboarding_service.py",
    "backend/app/services/food_analysis_service.py",
    "backend/app/services/packaged_food_service.py",
    "backend/app/services/indb_service.py",
    "backend/app/services/nutrition_service.py",
    "backend/app/services/external_food_service.py",
    "backend/app/services/gemini_service.py",
    "backend/app/services/ingredient_service.py",
    "backend/app/services/meal_log_service.py",
    "backend/app/services/progress_service.py",
    "backend/app/services/gamification_service.py",
    "backend/app/services/reminder_service.py",

    "backend/app/ml/model_loader.py",
    "backend/app/ml/preprocessing.py",
    "backend/app/ml/m2_classifier.py",
    "backend/app/ml/m3_regressor.py",
    "backend/app/ml/label_mapping.py",
    "backend/app/ml/inference_pipeline.py",

    "backend/app/utils/image_validation.py",
    "backend/app/utils/nutrition_formatting.py",
    "backend/app/utils/date_time.py",
    "backend/app/utils/file_storage.py",

    "backend/app/tests/test_m2_classifier.py",
    "backend/app/tests/test_m3_regressor.py",
    "backend/app/tests/test_indb_service.py",
    "backend/app/tests/test_food_analysis_api.py",
    "backend/app/tests/test_meal_logs_api.py",
    "backend/app/tests/test_progress_api.py",

    "backend/alembic/env.py",
    "backend/alembic/script.py.mako",
    "backend/scripts/export_notebook_artifacts.py",
    "backend/scripts/verify_model_artifacts.py",
    "backend/scripts/seed_indb.py",
    "backend/scripts/create_admin_user.py",

    "backend/app/data/indb/README.md",
    "backend/app/data/seed/badges.json",

    "backend/uploads/.gitkeep",
    "backend/app/ml/artifacts/.gitkeep",

    "backend/requirements.txt",
    "backend/.env.example",
    "backend/Dockerfile",
    "backend/alembic.ini",
    "backend/README.md"
)

foreach ($file in $backendFiles) {
    Ensure-File (Join-Path $root $file)
}

# ==========================================================
# Extra frontend folders only
# Existing Vite/Tailwind core files are never listed here.
# ==========================================================

$frontendDirectories = @(
    "frontend/src/api",
    "frontend/src/assets",
    "frontend/src/assets/images",
    "frontend/src/assets/icons",

    "frontend/src/components",
    "frontend/src/components/common",
    "frontend/src/components/auth",
    "frontend/src/components/onboarding",
    "frontend/src/components/food",
    "frontend/src/components/packaged-food",
    "frontend/src/components/dashboard",
    "frontend/src/components/gamification",
    "frontend/src/components/assistant",

    "frontend/src/pages",
    "frontend/src/hooks",
    "frontend/src/store",
    "frontend/src/utils"
)

foreach ($directory in $frontendDirectories) {
    Ensure-Directory (Join-Path $root $directory)
}

# ==========================================================
# Frontend placeholder files in JSX/JS
# Existing App.jsx, main.jsx, index.css are NOT touched.
# ==========================================================

$frontendFiles = @(
    "frontend/src/api/client.js",
    "frontend/src/api/authApi.js",
    "frontend/src/api/onboardingApi.js",
    "frontend/src/api/foodApi.js",
    "frontend/src/api/packagedFoodApi.js",
    "frontend/src/api/mealLogsApi.js",
    "frontend/src/api/progressApi.js",
    "frontend/src/api/gamificationApi.js",
    "frontend/src/api/assistantApi.js",

    "frontend/src/components/common/AppLayout.jsx",
    "frontend/src/components/common/Navbar.jsx",
    "frontend/src/components/common/BottomNavigation.jsx",
    "frontend/src/components/common/Button.jsx",
    "frontend/src/components/common/Card.jsx",
    "frontend/src/components/common/Modal.jsx",
    "frontend/src/components/common/LoadingSpinner.jsx",
    "frontend/src/components/common/ErrorMessage.jsx",
    "frontend/src/components/common/EmptyState.jsx",
    "frontend/src/components/common/ProtectedRoute.jsx",

    "frontend/src/components/auth/LoginForm.jsx",
    "frontend/src/components/auth/RegisterForm.jsx",

    "frontend/src/components/onboarding/ProfileQuestionnaire.jsx",
    "frontend/src/components/onboarding/GoalSelector.jsx",
    "frontend/src/components/onboarding/DietPreferenceSelector.jsx",
    "frontend/src/components/onboarding/ActivityLevelSelector.jsx",
    "frontend/src/components/onboarding/TargetSummary.jsx",

    "frontend/src/components/food/ImageUploader.jsx",
    "frontend/src/components/food/CameraCapture.jsx",
    "frontend/src/components/food/FoodAnalysisResult.jsx",
    "frontend/src/components/food/TopPredictions.jsx",
    "frontend/src/components/food/FoodSearchInput.jsx",
    "frontend/src/components/food/PortionEditor.jsx",
    "frontend/src/components/food/IngredientEditor.jsx",
    "frontend/src/components/food/NutritionCard.jsx",
    "frontend/src/components/food/MealTypeSelector.jsx",
    "frontend/src/components/food/FoodConfirmationForm.jsx",

    "frontend/src/components/packaged-food/BarcodeScanner.jsx",
    "frontend/src/components/packaged-food/PackagedLabelUploader.jsx",
    "frontend/src/components/packaged-food/NutritionLabelEditor.jsx",
    "frontend/src/components/packaged-food/ServingSizeEditor.jsx",
    "frontend/src/components/packaged-food/PackagedFoodConfirmation.jsx",

    "frontend/src/components/dashboard/DailySummaryCard.jsx",
    "frontend/src/components/dashboard/MacroProgress.jsx",
    "frontend/src/components/dashboard/MealTimeline.jsx",
    "frontend/src/components/dashboard/QuickAddMeal.jsx",
    "frontend/src/components/dashboard/StreakCard.jsx",
    "frontend/src/components/dashboard/WeeklyProgressChart.jsx",
    "frontend/src/components/dashboard/MissedMealPrompt.jsx",

    "frontend/src/components/gamification/LevelCard.jsx",
    "frontend/src/components/gamification/PointsCard.jsx",
    "frontend/src/components/gamification/BadgeList.jsx",
    "frontend/src/components/gamification/WeeklyChallenge.jsx",
    "frontend/src/components/gamification/ConsistencyScore.jsx",

    "frontend/src/components/assistant/ChatWindow.jsx",
    "frontend/src/components/assistant/ChatMessage.jsx",
    "frontend/src/components/assistant/SuggestedQuestions.jsx",

    "frontend/src/pages/LandingPage.jsx",
    "frontend/src/pages/LoginPage.jsx",
    "frontend/src/pages/RegisterPage.jsx",
    "frontend/src/pages/OnboardingPage.jsx",
    "frontend/src/pages/DashboardPage.jsx",
    "frontend/src/pages/AddMealPage.jsx",
    "frontend/src/pages/ConfirmMealPage.jsx",
    "frontend/src/pages/PackagedFoodPage.jsx",
    "frontend/src/pages/FoodHistoryPage.jsx",
    "frontend/src/pages/ProgressPage.jsx",
    "frontend/src/pages/GamificationPage.jsx",
    "frontend/src/pages/AssistantPage.jsx",
    "frontend/src/pages/SettingsPage.jsx",

    "frontend/src/hooks/useAuth.js",
    "frontend/src/hooks/useFoodAnalysis.js",
    "frontend/src/hooks/useMealLogs.js",
    "frontend/src/hooks/useProgress.js",
    "frontend/src/hooks/useGamification.js",
    "frontend/src/hooks/useAssistant.js",

    "frontend/src/store/authStore.js",
    "frontend/src/store/mealDraftStore.js",
    "frontend/src/store/uiStore.js",

    "frontend/src/utils/formatNutrition.js",
    "frontend/src/utils/formatDate.js",
    "frontend/src/utils/validation.js",
    "frontend/src/utils/constants.js",

    "frontend/.env.example",
    "frontend/README.md"
)

foreach ($file in $frontendFiles) {
    Ensure-File (Join-Path $root $file)
}

# ==========================================================
# Root docs/config placeholders
# They are skipped if they already exist.
# ==========================================================

$rootFiles = @(
    "docs/architecture.md",
    "docs/api-contract.md",
    "docs/model-workflow.md",
    "docs/database-schema.md",
    "docs/privacy-and-safety.md",
    "docker-compose.yml",
    ".gitignore",
    "README.md"
)

foreach ($file in $rootFiles) {
    Ensure-File (Join-Path $root $file)
}

Write-Host ""
Write-Host "=========================================================="
Write-Host "Ahar project structure is ready."
Write-Host "Existing React, Vite, Tailwind, App.jsx, main.jsx, and"
Write-Host "index.css files were preserved."
Write-Host "No model artifacts (.pt files) were created or changed."
Write-Host "=========================================================="