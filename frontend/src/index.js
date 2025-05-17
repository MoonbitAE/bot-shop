import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import botDetector from './botDetection';

// Start bot detection when the page is fully loaded
window.addEventListener('load', () => {
  botDetector.start();
});

ReactDOM.render(
  <App />,
  document.getElementById('root')
);