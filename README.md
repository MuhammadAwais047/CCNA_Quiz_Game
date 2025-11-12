# CCNA_Quiz_Game
For CCNA Exam Preparation
src/
├── core/
│   ├── app.js               # Application bootstrap
│   ├── state.js             # State management
│   ├── storage.js           # Local storage abstraction
│   └── audio.js             # Audio system
├── modules/
│   ├── quiz/
│   │   ├── quiz-engine.js
│   │   ├── quiz-view.js
│   │   └── quiz-styles.css
│   ├── subnetting/
│   ├── cli-simulator/
│   ├── drag-drop/
│   └── troubleshooting/
├── data/
│   ├── questions.js         # Dynamic data loading
│   └── schemas.js           # Data validation
├── ui/
│   ├── components/          # Reusable components
│   ├── layout/              # Layout system
│   └── theme.js             # Theme management
├── pwa/
│   ├── service-worker.js
│   ├── manifest.js
│   └── offline.js
├── utils/
│   ├── network.js
│   ├── accessibility.js
│   └── analytics.js
└── app.css                  # Main styles
public/
├── assets/
│   ├── audio/
│   ├── icons/
│   └── images/
├── index.html
└── version.json
