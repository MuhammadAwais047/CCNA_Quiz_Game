// CCNA Mastery Pro - Fixed Application Logic
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Hide loading screen with delay for smooth transition
        setTimeout(() => {
            document.getElementById('loading-screen').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('loading-screen').style.display = 'none';
                document.getElementById('app-container').style.display = 'block';
            }, 500);
        }, 800);
        
        // Load data from single consolidated file
        const dataResponse = await fetch('data.json');
        if (!dataResponse.ok) throw new Error('Failed to load app data');
        
        window.appData = await dataResponse.json();
        
        // Initialize the application
        initApplication();
        
        // Register service worker properly
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered successfully');
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
        
    } catch (error) {
        console.error('Application initialization failed:', error);
        showErrorMessage('Failed to load application. Please refresh the page.');
    }
});

function showErrorMessage(message) {
    document.getElementById('loading-screen').innerHTML = `
        <div style="text-align: center; color: #ff6b6b; padding: 20px;">
            <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 20px;"></i>
            <h2>Error Loading Application</h2>
            <p>${message}</p>
            <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #00d4ff; border: none; border-radius: 5px; color: white; cursor: pointer;">
                <i class="fas fa-redo"></i> Refresh Page
            </button>
        </div>
    `;
}

function initApplication() {
    // Render the main application UI
    document.getElementById('app-container').innerHTML = `
        <div class="container">
            <!-- Header -->
            <header class="header">
                <h1 class="title">CCNA MASTERY PRO</h1>
                <p class="subtitle">Interactive Learning Platform for Cisco Certification</p>
                <div class="stats-bar">
                    <div class="stat-item">
                        <i class="fas fa-trophy"></i> Score: <span class="stat-value" id="totalScore">0</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-fire"></i> Streak: <span class="stat-value" id="currentStreak">0</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-clock"></i> Time: <span class="stat-value" id="timer">00:00</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-question-circle"></i> Questions: <span class="stat-value" id="questionCount">0</span>/${window.appData.questions.length}
                    </div>
                </div>
            </header>
            
            <!-- Mode Selection -->
            <div id="modeSelection" class="game-modes">
                <div class="mode-card" onclick="startMode('quiz')">
                    <i class="fas fa-brain mode-icon"></i>
                    <h3 class="mode-title">Quiz Mode</h3>
                    <p class="mode-desc">Test your knowledge with ${window.appData.questions.length}+ real CCNA exam questions</p>
                    <div class="mode-stats">
                        <span>${window.appData.questions.length}+ Questions</span>
                        <span>Multiple Choice</span>
                    </div>
                </div>
                <div class="mode-card" onclick="startMode('subnet')">
                    <i class="fas fa-calculator mode-icon"></i>
                    <h3 class="mode-title">Subnetting Lab</h3>
                    <p class="mode-desc">Master IP subnetting with interactive calculations</p>
                    <div class="mode-stats">
                        <span>${window.appData.subnetting.length}+ Problems</span>
                        <span>Real-time Feedback</span>
                    </div>
                </div>
                <div class="mode-card" onclick="startMode('cards')">
                    <i class="fas fa-gamepad mode-icon"></i>
                    <h3 class="mode-title">Cards Matching</h3>
                    <p class="mode-desc">Memory game with networking concepts and terms</p>
                    <div class="mode-stats">
                        <span>Memory Game</span>
                        <span>Interactive</span>
                    </div>
                </div>
            </div>
            
            <!-- Quiz Mode (initially hidden) -->
            <div id="quizMode" class="quiz-container hidden">
                <div class="quiz-header">
                    <div class="quiz-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" id="quizProgress"></div>
                        </div>
                        <div class="quiz-info">
                            <span><i class="fas fa-question-circle"></i> Question <span id="currentQuestion">1</span> of ${window.appData.questions.length}</span>
                            <span><i class="fas fa-percentage"></i> <span id="quizPercentage">0</span>%</span>
                        </div>
                    </div>
                    <button class="action-button btn-secondary" onclick="backToMenu()">
                        <i class="fas fa-arrow-left"></i> Menu
                    </button>
                </div>
                <div class="question-card">
                    <div class="question-text" id="questionText"></div>
                    <div class="options-grid" id="optionsGrid"></div>
                </div>
                <div class="quiz-actions">
                    <button class="action-button btn-primary" id="submitAnswer" onclick="submitAnswer()">
                        Submit Answer
                    </button>
                    <button class="action-button btn-secondary" id="nextQuestion" onclick="nextQuestion()" disabled>
                        Next Question
                    </button>
                </div>
                <div id="questionFeedback" class="feedback-card hidden"></div>
            </div>
            
            <!-- Other mode containers will be added here -->
        </div>
    `;
    
    // Apply CSS styles
    applyStyles();
    
    // Initialize game state
    window.gameState = {
        currentMode: null,
        currentQuestion: 0,
        score: 0,
        streak: 0,
        startTime: null,
        selectedAnswer: null,
        usedQuestions: new Set(),
        soundEnabled: true
    };
    
    // Start timer
    startTimer();
    
    // Load saved progress
    loadProgress();
}

function applyStyles() {
    // Apply CSS styles programmatically for GitHub Pages compatibility
    const style = document.createElement('style');
    style.textContent = `
        :root {
            --bg-primary: #0a0e1a;
            --bg-secondary: #1a1f2e;
            --bg-tertiary: #2a3441;
            --accent-primary: #00d4ff;
            --accent-secondary: #ff6b6b;
            --accent-success: #4ecdc4;
            --accent-warning: #ffe66d;
            --text-primary: #ffffff;
            --text-secondary: #b8c5d1;
            --text-muted: #8892a0;
            --border-color: #3a4553;
            --shadow-primary: 0 8px 32px rgba(0, 212, 255, 0.1);
            --shadow-secondary: 0 4px 16px rgba(0, 0, 0, 0.3);
            --gradient-primary: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
            --gradient-secondary: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
            --gradient-success: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Inter', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            overflow-x: hidden;
            background-image: 
                radial-gradient(circle at 20% 80%, rgba(0, 212, 255, 0.1) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(255, 107, 107, 0.1) 0%, transparent 50%);
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            position: relative;
        }
        .title {
            font-family: 'Orbitron', monospace;
            font-size: 3.5rem;
            font-weight: 900;
            background: var(--gradient-primary);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 10px;
            text-shadow: 0 0 30px rgba(0, 212, 255, 0.3);
        }
        .subtitle {
            font-size: 1.2rem;
            color: var(--text-secondary);
            font-weight: 300;
        }
        .stats-bar {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        .stat-item {
            background: var(--bg-secondary);
            padding: 12px 24px;
            border-radius: 25px;
            border: 1px solid var(--border-color);
            font-weight: 600;
            transition: all 0.3s ease;
        }
        .stat-item:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow-primary);
        }
        .stat-value {
            color: var(--accent-primary);
            font-weight: 700;
        }
        .game-modes {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 25px;
            margin-bottom: 40px;
        }
        .mode-card {
            background: var(--bg-secondary);
            border-radius: 20px;
            padding: 30px;
            border: 1px solid var(--border-color);
            transition: all 0.3s ease;
            cursor: pointer;
            position: relative;
            overflow: hidden;
        }
        .mode-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: var(--gradient-primary);
            transform: scaleX(0);
            transition: transform 0.3s ease;
        }
        .mode-card:hover::before {
            transform: scaleX(1);
        }
        .mode-card:hover {
            transform: translateY(-8px);
            box-shadow: var(--shadow-primary);
            border-color: var(--accent-primary);
        }
        .mode-icon {
            font-size: 3rem;
            color: var(--accent-primary);
            margin-bottom: 15px;
            display: block;
        }
        .mode-title {
            font-size: 1.4rem;
            font-weight: 700;
            margin-bottom: 10px;
            color: var(--text-primary);
        }
        .mode-desc {
            color: var(--text-secondary);
            font-size: 0.95rem;
            margin-bottom: 15px;
        }
        .mode-stats {
            display: flex;
            justify-content: space-between;
            font-size: 0.85rem;
            color: var(--text-muted);
        }
        .quiz-container {
            background: var(--bg-secondary);
            border-radius: 20px;
            padding: 30px;
            margin-bottom: 30px;
            border: 1px solid var(--border-color);
            box-shadow: var(--shadow-secondary);
        }
        .quiz-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
            flex-wrap: wrap;
            gap: 15px;
        }
        .quiz-progress {
            flex: 1;
            min-width: 200px;
        }
        .progress-bar {
            width: 100%;
            height: 8px;
            background: var(--bg-tertiary);
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 8px;
        }
        .progress-fill {
            height: 100%;
            background: var(--gradient-primary);
            width: 0%;
            transition: width 0.5s ease;
        }
        .quiz-info {
            display: flex;
            gap: 20px;
            font-size: 0.9rem;
            color: var(--text-secondary);
        }
        .question-card {
            background: var(--bg-tertiary);
            border-radius: 15px;
            padding: 25px;
            margin-bottom: 25px;
            border: 1px solid var(--border-color);
        }
        .question-text {
            font-size: 1.2rem;
            font-weight: 600;
            margin-bottom: 20px;
            color: var(--text-primary);
        }
        .options-grid {
            display: grid;
            gap: 12px;
            margin-bottom: 25px;
        }
        .option-button {
            background: var(--bg-secondary);
            border: 2px solid var(--border-color);
            border-radius: 12px;
            padding: 15px 20px;
            font-size: 1rem;
            color: var(--text-primary);
            cursor: pointer;
            transition: all 0.3s ease;
            text-align: left;
        }
        .option-button:hover {
            border-color: var(--accent-primary);
            background: rgba(0, 212, 255, 0.1);
            transform: translateX(5px);
        }
        .option-button.selected {
            border-color: var(--accent-primary);
            background: var(--gradient-primary);
            color: white;
        }
        .option-button.correct {
            border-color: var(--accent-success);
            background: var(--gradient-success);
            color: white;
        }
        .option-button.incorrect {
            border-color: var(--accent-secondary);
            background: var(--gradient-secondary);
            color: white;
        }
        .quiz-actions {
            display: flex;
            gap: 15px;
            justify-content: center;
        }
        .action-button {
            padding: 12px 30px;
            border: none;
            border-radius: 25px;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .btn-primary {
            background: var(--gradient-primary);
            color: white;
        }
        .btn-secondary {
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
        }
        .action-button:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow-primary);
        }
        .hidden {
            display: none !important;
        }
        .feedback-card {
            background: var(--bg-tertiary);
            border-radius: 15px;
            padding: 20px;
            margin-top: 20px;
            border: 1px solid var(--border-color);
        }
        .feedback-success {
            border-color: var(--accent-success);
            background: rgba(78, 205, 196, 0.1);
        }
        .feedback-error {
            border-color: var(--accent-secondary);
            background: rgba(255, 107, 107, 0.1);
        }
        @media (max-width: 768px) {
            .title {
                font-size: 2.5rem;
            }
            .game-modes {
                grid-template-columns: 1fr;
            }
            .quiz-header {
                flex-direction: column;
                align-items: stretch;
            }
            .quiz-info {
                justify-content: space-between;
            }
            .quiz-actions {
                flex-direction: column;
            }
            .action-button {
                width: 100%;
            }
        }
    `;
    document.head.appendChild(style);
}

// Quiz functionality
function startMode(mode) {
    playSound('click');
    window.gameState.currentMode = mode;
    window.gameState.startTime = Date.now();
    
    // Hide mode selection
    document.getElementById('modeSelection').classList.add('hidden');
    
    // Show appropriate mode container
    document.getElementById('quizMode').classList.toggle('hidden', mode !== 'quiz');
    
    if (mode === 'quiz') {
        loadNextQuestion();
    }
}

function loadNextQuestion() {
    if (window.gameState.usedQuestions.size >= window.appData.questions.length) {
        endQuiz();
        return;
    }
    
    // Get random unused question
    let availableQuestions = window.appData.questions.filter(q => 
        !Array.from(window.gameState.usedQuestions).some(used => used.id === q.id)
    );
    
    if (availableQuestions.length === 0) {
        endQuiz();
        return;
    }
    
    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    const question = availableQuestions[randomIndex];
    window.gameState.usedQuestions.add(question);
    window.gameState.currentQuestion++;
    window.gameState.selectedAnswer = null;
    
    // Update UI
    document.getElementById('questionText').textContent = question.question;
    document.getElementById('currentQuestion').textContent = window.gameState.currentQuestion;
    document.getElementById('questionCount').textContent = window.gameState.usedQuestions.size;
    
    // Update progress
    const percentage = (window.gameState.usedQuestions.size / window.appData.questions.length) * 100;
    document.getElementById('quizProgress').style.width = percentage + '%';
    document.getElementById('quizPercentage').textContent = Math.round(percentage);
    
    // Create options
    const optionsGrid = document.getElementById('optionsGrid');
    optionsGrid.innerHTML = '';
    question.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'option-button';
        button.textContent = `${String.fromCharCode(65 + index)}. ${option}`;
        button.onclick = () => selectAnswer(index, button);
        optionsGrid.appendChild(button);
    });
    
    // Reset buttons
    document.getElementById('submitAnswer').disabled = false;
    document.getElementById('nextQuestion').disabled = true;
    document.getElementById('questionFeedback').classList.add('hidden');
}

function selectAnswer(index, button) {
    playSound('click');
    // Remove previous selection
    document.querySelectorAll('.option-button').forEach(btn => {
        btn.classList.remove('selected');
    });
    // Select current answer
    button.classList.add('selected');
    window.gameState.selectedAnswer = index;
}

function submitAnswer() {
    if (window.gameState.selectedAnswer === null) return;
    
    const questionsArray = Array.from(window.gameState.usedQuestions);
    const question = questionsArray[questionsArray.length - 1];
    const isCorrect = window.gameState.selectedAnswer === question.correct;
    
    // Play sound
    playSound(isCorrect ? 'correct' : 'incorrect');
    
    // Update score
    if (isCorrect) {
        window.gameState.score += 10;
        window.gameState.streak++;
    } else {
        window.gameState.streak = 0;
    }
    updateStats();
    
    // Show feedback
    showQuestionFeedback(isCorrect, question);
    
    // Update option buttons
    document.querySelectorAll('.option-button').forEach((button, index) => {
        if (index === question.correct) {
            button.classList.add('correct');
        } else if (index === window.gameState.selectedAnswer && !isCorrect) {
            button.classList.add('incorrect');
        }
        button.style.pointerEvents = 'none';
    });
    
    // Update button states
    document.getElementById('submitAnswer').disabled = true;
    document.getElementById('nextQuestion').disabled = false;
}

function showQuestionFeedback(isCorrect, question) {
    const feedback = document.getElementById('questionFeedback');
    feedback.className = `feedback-card ${isCorrect ? 'feedback-success' : 'feedback-error'}`;
    feedback.innerHTML = `
        <h4><i class="fas ${isCorrect ? 'fa-check-circle' : 'fa-times-circle'}"></i> ${isCorrect ? 'Correct!' : 'Incorrect'}</h4>
        <p><strong>Explanation:</strong> ${question.explanation}</p>
        <p><strong>Category:</strong> ${question.category}</p>
    `;
    feedback.classList.remove('hidden');
}

function nextQuestion() {
    playSound('click');
    loadNextQuestion();
}

function backToMenu() {
    playSound('click');
    // Hide all mode containers
    document.getElementById('quizMode').classList.add('hidden');
    
    // Show mode selection
    document.getElementById('modeSelection').classList.remove('hidden');
    window.gameState.currentMode = null;
    saveProgress();
}

function updateStats() {
    document.getElementById('totalScore').textContent = window.gameState.score;
    document.getElementById('currentStreak').textContent = window.gameState.streak;
}

function startTimer() {
    setInterval(() => {
        if (window.gameState.startTime) {
            const elapsed = Math.floor((Date.now() - window.gameState.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            document.getElementById('timer').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

function playSound(type) {
    if (!window.gameState.soundEnabled) return;
    
    try {
        const sound = document.getElementById(type + 'Sound');
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(() => {});
        }
    } catch (e) {
        // Ignore audio errors
    }
}

function saveProgress() {
    localStorage.setItem('ccnaProgress', JSON.stringify({
        score: window.gameState.score,
        streak: window.gameState.streak,
        lastPlayed: new Date().toISOString(),
        usedQuestions: Array.from(window.gameState.usedQuestions).map(q => q.id)
    }));
}

function loadProgress() {
    const saved = localStorage.getItem('ccnaProgress');
    if (saved) {
        const progress = JSON.parse(saved);
        window.gameState.score = progress.score || 0;
        window.gameState.streak = progress.streak || 0;
        updateStats();
    }
}

function endQuiz() {
    document.getElementById('quizMode').classList.add('hidden');
    playSound('success');
    
    const percentage = Math.round((window.gameState.score / (window.gameState.usedQuestions.size * 10)) * 100);
    alert(`🎉 Quiz Complete!
Final Score: ${window.gameState.score} points
Questions Answered: ${window.gameState.usedQuestions.size}
Accuracy: ${percentage}%
Best Streak: ${window.gameState.streak}`);
    
    // Reset for next quiz
    window.gameState.usedQuestions.clear();
    backToMenu();
}
