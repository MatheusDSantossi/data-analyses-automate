const Home = () => {
  return (
    <div>
      <div className="top-0">
        <img className="h-16" src="/src/assets/logo.png" alt="System Logo" />
      </div>
      <main className="flex flex-col justify-center items-center h-screen">
        <header className="flex flex-col items-start mb-16">
          <h1 className="font-medium text-2xl">Welcome to our Automate Data Analyse Wizard Tool</h1>
          <h4>Select the file to start the magic</h4>
          {/* Add some magic here (stars or something) */}
        </header>
        <section>
          {/* <label htmlFor="data_file" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Select the file!!</label> */}
          <input
            type="file"
            className="block w-full mb-5 p-2 text-sm text-primary border border-gray-300 rounded-lg cursor-pointer bg-gray-700 hover:bg-white-200 dark:text-secondary-dark focus:outline-none dark:bg-white dark:border-gray-600 dark:placeholder-gray-400"
            id="data_file"
          />
        </section>
      </main>
    </div>
  );
};

export default Home;
