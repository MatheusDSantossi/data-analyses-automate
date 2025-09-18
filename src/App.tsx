import { Route, Routes } from "react-router-dom";
import "./App.css";
import Home from "./components/home/Home";
import Dashboard from "./components/dashboard/Dashboard";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </>
  );
}

export default App;
