// App.js
import "./index.css";
import React, { useState } from "react";
import image from "./search_icon.png";
const App = () => {
  const [text, setText] = useState("");
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault(); // Prevent the default form submission behavior

    try {
      const res = await fetch("http://localhost:5000/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }), // Send the text field value as JSON
      });
      const result = await res.json(); // Assuming the server responds with JSON
      setResponse(result);
    } catch (err) {
      setError(
        "No results"
      );
    }
  };

  return (
    <div className="flex items-center justify-center h-full">
    <div className="flex flex-col items-center space-y-4 w-3/5 ">
      <h1 className="text-5xl">QueryQuest</h1>
      <p>Distributed Web Crawler and Search Engine</p>
      <form
        onSubmit={handleSubmit}
        className="border border-black p-2 rounded-full flex items-center"
    >
        <input
            placeholder="Enter text..."
            className="focus:outline-none w-96"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="flex-shrink-0">
            <img className="w-8 h-8" src={image} alt="Submit"/>
        </button>
    </form>
      <p></p>
      {response && <div className="space-y-2">
        <p className="text-sm">{response.message.length} results found</p>
         {response.message.map(url => {
        return (<div className="border-0 border-black rounded-lg p-4 shadow-md w-full hover:shadow-lg hover:translate-y-[-5px] hover:translate-x-[-5px] hover:scale-103">
          {url.title ? (
  <>
    <a target="_blank" rel="noreferrer" href={url.url} className="text-blue-900 hover:underline hover:cursor-pointer text-xl">{url.title}</a>
    <p className="text-sm">{url.url}</p>
    <p>{url.content}...</p>
  </>
) : (
  <>
  <a target="_blank" rel="noreferrer"  href={url.url} className="text-blue-900 hover:underline hover:cursor-pointer text-xl">{url.url}</a>
  <p>{url.content}...</p>
  </>
)}
        </div>)
      })}</div>}

      {error && <div>{error}</div>}
    </div>
    </div>
  );
};

export default App;
