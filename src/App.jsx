import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./Pages/home";
import Join from "./Pages/Join";    
import LoginPage from "./Pages/LoginPage";

function App() {
  return (
    <Router>
      <Routes>
        {/* Landing page with navbar */}
        <Route
          path="/"
          element={
            <>
              <Navbar />
              <Home />
            </>
          }
        />

        {/* Join page without navbar */}
        <Route path="/Join" element={<Join />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </Router>
  );
}

export default App;
