import { sanitizeHTML } from '../../utils/security.js';
import { formatTime } from '../../utils/time.js';

export class QuestionCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.state = {
      question: '',
      options: [],
      selectedAnswer: null,
      correctAnswer: null,
      feedback: null,
      disabled: false,
      timer: 0
    };
  }

  static get observedAttributes() {
    return ['disabled'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'disabled' && oldValue !== newValue) {
      this.state.disabled = newValue !== null;
      this.render();
    }
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.handleOptionClick);
  }

  setupEventListeners() {
    document.addEventListener('quiz:question-change', this.handleQuestionChange.bind(this));
    document.addEventListener('quiz:answer-selected', this.handleAnswerSelected.bind(this));
    document.addEventListener('quiz:answer-submitted', this.handleAnswerSubmitted.bind(this));
    document.addEventListener('quiz:timer-update', this.handleTimerUpdate.bind(this));
    
    // Cleanup on navigation
    document.addEventListener('app:navigation', () => {
      document.removeEventListener('quiz:question-change', this.handleQuestionChange.bind(this));
      document.removeEventListener('quiz:answer-selected', this.handleAnswerSelected.bind(this));
      document.removeEventListener('quiz:answer-submitted', this.handleAnswerSubmitted.bind(this));
      document.removeEventListener('quiz:timer-update', this.handleTimerUpdate.bind(this));
    });
  }

  handleQuestionChange(event) {
    const { question, options, selectedAnswer, currentNumber, totalQuestions } = event.detail;
    this.state = {
      ...this.state,
      question,
      options,
      selectedAnswer,
      currentNumber,
      totalQuestions,
      feedback: null,
      correctAnswer: null,
      disabled: false
    };
    this.render();
  }

  handleAnswerSelected(event) {
    this.state.selectedAnswer = event.detail;
    this.render();
  }

  handleAnswerSubmitted(event) {
    const { isCorrect, explanation, category } = event.detail;
    this.state = {
      ...this.state,
      disabled: true,
      correctAnswer: this.state.currentQuestion?.correct, // This would come from state
      feedback: {
        isCorrect,
        explanation,
        category
      }
    };
    this.render();
  }

  handleTimerUpdate(event) {
    this.state.timer = event.detail;
    if (this.shadowRoot) {
      const timerEl = this.shadowRoot.getElementById('question-timer');
      if (timerEl) {
        timerEl.textContent = formatTime(this.state.timer);
      }
    }
  }

  handleOptionClick(e) {
    if (this.state.disabled) return;
    
    const optionEl = e.target.closest('.option');
    if (!optionEl) return;
    
    const index = parseInt(optionEl.dataset.index);
    if (isNaN(index)) return;
    
    // Dispatch event to engine
    document.dispatchEvent(new CustomEvent('quiz:option-selected', { detail: index }));
  }

  render() {
    const { question, options, selectedAnswer, feedback, disabled, currentNumber = 0, totalQuestions = 0 } = this.state;
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: var(--surface-card);
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: var(--shadow-medium);
          transition: all 0.3s ease;
          border: 1px solid var(--border-color);
        }
        
        .question-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--border-color);
        }
        
        .question-number {
          font-size: 0.875rem;
          color: var(--text-secondary);
          font-weight: 500;
        }
        
        #question-timer {
          font-size: 0.875rem;
          color: var(--primary-400);
          font-weight: 600;
        }
        
        .question-text {
          font-size: 1.25rem;
          line-height: 1.5;
          margin-bottom: 1.5rem;
          color: var(--text-primary);
          font-weight: 600;
        }
        
        .options-container {
          display: grid;
          gap: 0.75rem;
        }
        
        .option {
          background: var(--surface-secondary);
          border: 2px solid var(--border-color);
          border-radius: 12px;
          padding: 1rem 1.25rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          font-size: 1rem;
          color: var(--text-primary);
        }
        
        .option:hover:not(.disabled) {
          border-color: var(--primary-500);
          background: var(--primary-900);
          transform: translateX(4px);
        }
        
        .option.selected {
          border-color: var(--primary-500);
          background: var(--primary-900);
          position: relative;
        }
        
        .option.selected::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: var(--primary-500);
          border-radius: 4px 0 0 4px;
        }
        
        .option.correct {
          border-color: var(--success-500);
          background: var(--success-900);
        }
        
        .option.incorrect {
          border-color: var(--error-500);
          background: var(--error-900);
        }
        
        .option-label {
          min-width: 1.5rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          margin-right: 0.75rem;
        }
        
        .feedback-container {
          margin-top: 1.5rem;
          padding: 1rem;
          border-radius: 12px;
          background: var(--surface-secondary);
          border-left: 3px solid var(--primary-500);
        }
        
        .feedback-container.correct {
          border-left-color: var(--success-500);
          background: var(--success-900);
        }
        
        .feedback-container.incorrect {
          border-left-color: var(--error-500);
          background: var(--error-900);
        }
        
        .feedback-header {
          display: flex;
          align-items: center;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }
        
        .feedback-icon {
          margin-right: 0.5rem;
          font-size: 1.25rem;
        }
        
        .feedback-explanation {
          line-height: 1.5;
          margin-bottom: 0.75rem;
        }
        
        .feedback-category {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }
        
        .disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        @media (max-width: 768px) {
          :host {
            padding: 1rem;
          }
          
          .question-text {
            font-size: 1.1rem;
          }
        }
      </style>
      
      <div class="question-header">
        <div class="question-number">
          Question ${currentNumber || 0} of ${totalQuestions || 0}
        </div>
        <div id="question-timer">${formatTime(this.state.timer)}</div>
      </div>
      
      <div class="question-text">
        ${sanitizeHTML(question || 'Loading question...')}
      </div>
      
      <div class="options-container">
        ${(options || []).map((option, index) => {
          const isSelected = selectedAnswer === index;
          const isCorrect = feedback?.isCorrect && selectedAnswer === index;
          const isIncorrect = !feedback?.isCorrect && selectedAnswer === index;
          const isCorrectAnswer = feedback && index === this.state.correctAnswer;
          
          const classes = [
            'option',
            isSelected ? 'selected' : '',
            isCorrect ? 'correct' : '',
            isIncorrect ? 'incorrect' : '',
            isCorrectAnswer ? 'correct' : '',
            disabled ? 'disabled' : ''
          ].filter(Boolean).join(' ');
          
          return `
            <div class="${classes}" data-index="${index}">
              <span class="option-label">${String.fromCharCode(65 + index)}</span>
              <span class="option-text">${sanitizeHTML(option)}</span>
            </div>
          `;
        }).join('')}
      </div>
      
      ${feedback ? `
        <div class="feedback-container ${feedback.isCorrect ? 'correct' : 'incorrect'}">
          <div class="feedback-header">
            <span class="feedback-icon">${feedback.isCorrect ? '✓' : '✗'}</span>
            <span>${feedback.isCorrect ? 'Correct!' : 'Incorrect'}</span>
          </div>
          <div class="feedback-explanation">${sanitizeHTML(feedback.explanation)}</div>
          <div class="feedback-category">Category: ${sanitizeHTML(feedback.category)}</div>
        </div>
      ` : ''}
    `;
    
    // Add event listeners after rendering
    this.shadowRoot.querySelectorAll('.option').forEach(option => {
      option.addEventListener('click', this.handleOptionClick.bind(this));
    });
  }
}

// Register custom element
customElements.define('question-card', QuestionCard);
