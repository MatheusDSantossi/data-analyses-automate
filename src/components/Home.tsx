const Home = () => {
  return (
    <main>
      <header className="mb-5">
        <h1>Welcome to our Automate Data Analyse Wizard Tool</h1>
        <h4>Select the file to start the magic</h4> 
        {/* Add some magic here (stars or something) */}
      </header>
      <section>
        {/* <label htmlFor="data_file" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Select the file!!</label> */}
        <input type="file" className="block w-full mb-5 text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-amber-400 dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400" id="data_file" />
      </section>
    </main>
  );
};

export default Home;
