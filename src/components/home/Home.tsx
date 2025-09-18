import { useState } from "react";
import "./Home.css";
import { Input, type InputChangeEvent } from "@progress/kendo-react-inputs";
import CustomButton from "../../ui/CustomButton";
import { useNavigate } from "react-router-dom";
import { useFile } from "../../context/FileContext";


const Home = () => {
  const navigate = useNavigate();
  const { setFile, setParsedData } = useFile();

  // State
  const [selectedFileName, setSelectedFileName] = useState<
    string | undefined
  >();

  // Function to handle the selected file and work with it
  const handleFileChange = (event: InputChangeEvent) => {
    const files = event.target.element?.files;

    if (files && files.length > 0) {
      const file = files[0];
      setFile(file);
      setSelectedFileName(file.name);
      // parseFile(file).then(rows => setParsedData(rows))
      console.log(files[0].name);
    } else {
      alert("You must select a file");
    }
  };
  

  const goToDashboard = () => {
    // ensure user selected a file before navigating
    if (!selectedFileName) {
      alert("Please select a file first.");
      return;
    }
    navigate("/dashboard");
  };

  return (
    <div>
      <div className="top-0">
        <img className="h-16" src="/src/assets/logo.png" alt="System Logo" />
      </div>
      <main className="flex flex-col justify-center items-center h-screen">
        <header className="flex flex-col items-start mb-16">
          <h1 className="font-medium text-2xl">
            Welcome to our{" "}
            <span className="highlight c3">
              Automate Data Analyse Wizard Tool
            </span>
          </h1>
          <h4>Select the file to start the magic</h4>
          {/* Add some magic here (stars or something) */}
        </header>
        <section>
          {/* <label htmlFor="data_file" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Select the file!!</label> */}

          <Input
            className="block w-full mb-5 p-2 text-sm text-primary border border-gray-300 rounded-lg cursor-pointer bg-gray-700 hover:bg-white-200 dark:text-secondary-dark focus:outline-none dark:bg-white dark:border-gray-600 dark:placeholder-gray-400"
            type="file"
            id="file_select"
            onChange={handleFileChange}
          />
          <CustomButton onClick={goToDashboard} />
        </section>
      </main>
    </div>
  );
};

export default Home;
