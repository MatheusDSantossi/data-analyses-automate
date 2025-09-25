import { Route, Routes } from "react-router-dom";
import "./App.css";
import Home from "./components/home/Home";
import Dashboard from "./components/dashboard/Dashboard";
import Wizard from "./components/dashboard/chartTools/Wizard";
import { useFile } from "./context/FileContext";

function App() {
  const { parsedData } = useFile();
  
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/edit" element={<Wizard data={parsedData} />} />
      </Routes>
    </>
  );
}

export default App;
