import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Import Tailwind CSS styles
import App from './App';
import './App.css'; // Import App-specific styles

// This is the entry point of your React application.
// It finds the 'root' div in your public/index.html file and renders the App component into it.

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);