import { useState } from 'react';
import Login from './Login';
import Signup from './Signup';
import './App.css';

export default function App() {
  const [page, setPage] = useState('login');

  return (
    <>
      {page === 'login' && (
        <Login onNavigateSignup={() => setPage('signup')} />
      )}
      {page === 'signup' && (
        <Signup onNavigateLogin={() => setPage('login')} />
      )}
    </>
  );
}
