import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Web3Provider } from './context/Web3Context';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Verify from './pages/Verify';
import Gallery from './pages/Gallery';
import Issue from './pages/Issue';
import Admin from './pages/Admin';
import CertificateDetail from './pages/CertificateDetail';
import './App.css';

function App() {
  return (
    <Web3Provider>
      <Router>
        <div className="app">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/verify" element={<Verify />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/issue" element={<Issue />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/certificate/:id" element={<CertificateDetail />} />
            </Routes>
          </main>
          <Toaster 
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1a1a2e',
                color: '#fff',
                border: '1px solid #4a4a6a'
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff'
                }
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff'
                }
              }
            }}
          />
        </div>
      </Router>
    </Web3Provider>
  );
}

export default App;
