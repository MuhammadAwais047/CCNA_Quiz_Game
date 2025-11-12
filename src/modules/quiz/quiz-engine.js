import CCNAState from '../../core/state.js';
import { shuffleArray } from '../../utils/array-helpers.js';
import { sanitizeHTML } from '../../utils/security.js';

const DIFFICULTY_WEIGHTS = {
  easy: 1,
  medium: 2,
  hard: 3
};

export class QuizEngine {
  constructor() {
    this.state = {
      currentQuestion: null,
      questions: [],
      questionHistory: [],
      selectedAnswer: null,
      timeSpent: 0,
      startTime: null
    };
    
    this.timer = null;
    this.questionBank = [];
  }

  async initialize(category = null, difficulty = null, count = 20) {
    try {
      // Load questions from data store
      this.questionBank = await this.loadQuestions(category, difficulty);
      
      if (this.questionBank.length === 0) {
        throw new Error('No questions available for the selected filters');
      }
      
      // Apply smart selection algorithm
      this.questions = this.selectQuestions(count);
      
      // Start first question
      this.startQuestion();
      
      console.info(`[Quiz] Started with ${this.questions.length} questions`);
      return true;
    } catch (error) {
      console.error('[Quiz] Initialization failed:', error);
      throw error;
    }
  }

  async loadQuestions(category, difficulty) {
    try {
      // Check cache first
      const cacheKey = `questions_${category || 'all'}_${difficulty || 'all'}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) { // 24 hours cache
          return data;
        }
      }
      
      // Fetch from network
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (difficulty) params.append('difficulty', difficulty);
      
      const response = await fetch(`/data/questions.json?${params.toString()}`);
      let questions = await response.json();
      
      // Apply filtering if needed
      if (category) {
        questions = questions.filter(q => q.category === category);
      }
      if (difficulty) {
        questions = questions.filter(q => q.difficulty === difficulty);
      }
      
      // Cache the results
      localStorage.setItem(cacheKey, JSON.stringify({ 
        data: questions, 
        timestamp: Date.now() 
      }));
      
      return questions;
    } catch (error) {
      console.error('[Quiz] Failed to load questions:', error);
      
      // Fallback to cached questions if available
      const cacheKey = `questions_${category || 'all'}_${difficulty || 'all'}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        return JSON.parse(cached).data;
      }
      
      // Ultimate fallback - empty array
      return [];
    }
  }

  selectQuestions(count) {
    // Smart selection algorithm that balances:
    // 1. Difficulty progression
    // 2. Category distribution
    // 3. Avoiding consecutive similar questions
    
    const availableQuestions = [...this.questionBank];
    const selected = [];
    const categories = [...new Set(availableQuestions.map(q => q.category))];
    const difficulties = [...new Set(availableQuestions.map(q => q.difficulty))];
    
    // Sort by priority (unanswered -> incorrect -> correct)
    availableQuestions.sort((a, b) => {
      const aProg = CCNAState.state.progress?.quizzes?.[a.id] || { status: 'unanswered' };
      const bProg = CCNAState.state.progress?.quizzes?.[b.id] || { status: 'unanswered' };
      
      const priority = { unanswered: 3, incorrect: 2, correct: 1 };
      return priority[bProg.status] - priority[aProg.status];
    });
    
    // Select questions with balanced distribution
    let currentLevel = 0;
    const levelSize = Math.ceil(count / difficulties.length);
    
    while (selected.length < count && availableQuestions.length > 0) {
      const difficulty = difficulties[currentLevel % difficulties.length];
      const candidates = availableQuestions.filter(q => q.difficulty === difficulty);
      
      if (candidates.length > 0) {
        // Pick a random question from this difficulty level
        const index = Math.floor(Math.random() * candidates.length);
        const question = candidates[index];
        selected.push(question);
        
        // Remove from available questions
        const originalIndex = availableQuestions.findIndex(q => q.id === question.id);
        if (originalIndex !== -1) {
          availableQuestions.splice(originalIndex, 1);
        }
      }
      
      currentLevel++;
      
      // If we've gone through all difficulties and still need questions, reset
      if (currentLevel > difficulties.length && selected.length < count) {
        currentLevel = 0;
      }
    }
    
    return selected;
  }

  startQuestion() {
    if (this.questions.length === 0) {
      this.endQuiz();
      return;
    }
    
    this.state.currentQuestion = this.questions.shift();
    this.state.selectedAnswer = null;
    this.state.startTime = Date.now();
    
    // Start timer
    this.startTimer();
    
    // Dispatch event for UI update
    document.dispatchEvent(new CustomEvent('quiz:question-change', { 
      detail: this.getQuestionState() 
    }));
  }

  startTimer() {
    clearInterval(this.timer);
    this.state.timeSpent = 0;
    
    this.timer = setInterval(() => {
      this.state.timeSpent++;
      document.dispatchEvent(new CustomEvent('quiz:timer-update', { 
        detail: this.state.timeSpent 
      }));
    }, 1000);
  }

  stopTimer() {
    clearInterval(this.timer);
  }

  selectAnswer(index) {
    this.state.selectedAnswer = index;
    document.dispatchEvent(new CustomEvent('quiz:answer-selected', { 
      detail: index 
    }));
  }

  submitAnswer() {
    if (this.state.selectedAnswer === null) return;
    
    this.stopTimer();
    
    const question = this.state.currentQuestion;
    const isCorrect = this.state.selectedAnswer === question.correct;
    const timeSpent = this.state.timeSpent;
    
    // Update session stats
    let streak = CCNAState.state.session.streak;
    let score = CCNAState.state.session.score;
    
    if (isCorrect) {
      streak++;
      // Score based on difficulty and speed
      const difficultyWeight = DIFFICULTY_WEIGHTS[question.difficulty] || 1;
      const timeBonus = Math.max(0, 30 - timeSpent); // Max 30 seconds for full points
      const basePoints = 10 * difficultyWeight;
      const bonusPoints = Math.floor(timeBonus * 0.5);
      score += basePoints + bonusPoints;
      
      // Play correct sound
      document.dispatchEvent(new CustomEvent('audio:play', { detail: 'correct' }));
    } else {
      streak = 0;
      // Play incorrect sound
      document.dispatchEvent(new CustomEvent('audio:play', { detail: 'incorrect' }));
    }
    
    // Update global state
    CCNAState.setState({ 
      session: { 
        ...CCNAState.state.session, 
        streak, 
        score 
      } 
    });
    
    // Track progress
    CCNAState.trackProgress('quizzes', question.id, isCorrect ? 'correct' : 'incorrect');
    
    // Record question history
    this.state.questionHistory.push({
      questionId: question.id,
      selectedAnswer: this.state.selectedAnswer,
      correctAnswer: question.correct,
      isCorrect,
      timeSpent,
      timestamp: Date.now()
    });
    
    // Dispatch event with feedback
    document.dispatchEvent(new CustomEvent('quiz:answer-submitted', { 
      detail: { isCorrect, explanation: question.explanation, category: question.category }
    }));
  }

  nextQuestion() {
    this.startQuestion();
  }

  skipQuestion() {
    this.stopTimer();
    
    // Record skipped question
    this.state.questionHistory.push({
      questionId: this.state.currentQuestion.id,
      skipped: true,
      timestamp: Date.now()
    });
    
    // Track as unanswered
    CCNAState.trackProgress('quizzes', this.state.currentQuestion.id, 'unanswered');
    
    this.startQuestion();
  }

  endQuiz() {
    this.stopTimer();
    
    // Calculate stats
    const totalQuestions = this.state.questionHistory.length;
    const correctAnswers = this.state.questionHistory.filter(q => q.isCorrect).length;
    const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    const totalTime = this.state.questionHistory.reduce((sum, q) => sum + (q.timeSpent || 0), 0);
    const avgTimePerQuestion = totalQuestions > 0 ? Math.round(totalTime / totalQuestions) : 0;
    
    const results = {
      score: CCNAState.state.session.score,
      streak: CCNAState.state.session.streak,
      accuracy,
      totalTime,
      avgTimePerQuestion,
      questionHistory: this.state.questionHistory
    };
    
    // Dispatch results event
    document.dispatchEvent(new CustomEvent('quiz:complete', { detail: results }));
    
    // Reset quiz state
    this.reset();
  }

  reset() {
    clearInterval(this.timer);
    this.state = {
      currentQuestion: null,
      questions: [],
      questionHistory: [],
      selectedAnswer: null,
      timeSpent: 0,
      startTime: null
    };
  }

  getQuestionState() {
    if (!this.state.currentQuestion) return null;
    
    return {
      question: sanitizeHTML(this.state.currentQuestion.question),
      options: this.state.currentQuestion.options.map(opt => sanitizeHTML(opt)),
      selectedAnswer: this.state.selectedAnswer,
      currentNumber: this.state.questionHistory.length + 1,
      totalQuestions: this.state.questionHistory.length + this.questions.length + 1,
      progress: Math.round(((this.state.questionHistory.length) / (this.state.questionHistory.length + this.questions.length + 1)) * 100)
    };
  }
}

// Singleton instance
export default new QuizEngine();
