import { useEffect, useMemo, useState } from "react";
import "./Home.css";
import { Input, type InputChangeEvent } from "@progress/kendo-react-inputs";
import CustomButton from "../../ui/CustomButton";
import { useNavigate } from "react-router-dom";
import { useFile } from "../../context/FileContext";
import { Error } from "@progress/kendo-react-labels";
import { Reveal } from "@progress/kendo-react-animation";

const Home = () => {
  const navigate = useNavigate();
  const { setFile } = useFile();

  // State
  const [selectedFileName, setSelectedFileName] = useState<
    string | undefined
  >();
  const [key, setKey] = useState(0); // Key to force re-rendering of Reveal component
  // const allowedFileTypes = [
  //   "application/xlsx",
  //   "application/xls",
  //   "text/csv",
  //   "sheet"
  // ];

  // Function to handle the selected file and work with it
  const handleFileChange = (event: InputChangeEvent) => {
    const files = event.target.element?.files;

    if (files && files.length > 0) {
      const file: File = files[0];
      console.log(file.type);

      // if (allowedFileTypes.includes(file.type)) {
      setFile(file);
      setSelectedFileName(file.name);
      // parseFile(file).then(rows => setParsedData(rows))
      console.log(files[0].name);
      // }
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

  // This component generates the shootings stars.
  // It's memoized to prevent re-calculating random values on every render.
  const ShootingStars = () => {
    // Use memo will only re-run when its dependencies change. Here, it's an empty array, so it runs only once.
    const stars = useMemo(() => {
      // Create an array of 50 stars
      return [...Array(20)].map((_, i) => {
        // Generate random values for each star's style
        const style = {
          // Random top position (from -200px to 200px around the vertical center)
          top: `calc(50% + ${Math.round(Math.random() * 400) - 200}px)`,
          // Random left position (from -300px to 0px from the horizontal center)
          left: `calc(50% - ${Math.round(Math.random() * 300)}px)`,
          // Random animation delay to make stars appear at different times
          animationDelay: `${Math.random() * 10000}ms`,
        };
        // Return a div for each star with its unique key and style
        return <div key={i} className="shooting_star" style={style} />;
      });
    }, []);

    return <div className="night">{stars}</div>;
  };

  useEffect(() => {
    // Force re-rendering of the Reveal component to trigger the animation
    setKey((prevKey) => prevKey + 1);
  }, []);

  return (
    <div>
      {/* Shooting stars container */}
      {selectedFileName && (
        <div className="stars-container">
          <ShootingStars />
        </div>
      )}

      <Reveal className="w-full">
        <div className="relative mt-10 left-32" key={key}>
          <img className="h-10" src="/logo.png" alt="System Logo" />
          {/* <img className="h-10" src="/src/assets/logo.png" alt="System Logo" /> */}
        </div>
        <main className="flex flex-col justify-center items-center h-screen">
          <header className="flex flex-col items-start mb-26">
            <h1 className="font-medium text-2xl">
              Welcome to our{" "}
              <span className="highlight c3 transition-all duration-300">
                Automate Data Analyse Wizard Tool
              </span>
            </h1>
            <h4 className="text-md">Select a file to start the magic 🪄</h4>
            {/* Add some magic here (stars or something) */}
          </header>
          <section className="flex flex-col gap-3">
            {/* <label htmlFor="data_file" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Select the file!!</label> */}

            <Input
              className="block shadow-2xl! w-full text-sm
              file:mr-4 file:py-2 file:px-3
              file:border-0
              file:text-sm file:font-semibold
              file:bg-violet-50 file:text-secondary-dark
              hover:file:bg-tertiary
              file:cursor-pointer
              cursor-pointer
              border border-tertiary rounded-lg
              focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
              file:transition file:duration-300 file:ease-in-out"
              type="file"
              id="file_select"
              onChange={handleFileChange}
            />
            {!selectedFileName && (
              <Error
                id={"file_select"}
                className="text-red-500 font-medium italic"
              >
                You need to select a file
              </Error>
            )}

            <CustomButton
              onClick={goToDashboard}
              isDisabled={!selectedFileName}
            />
          </section>
        </main>
      </Reveal>
    </div>
  );
};

export default Home;
