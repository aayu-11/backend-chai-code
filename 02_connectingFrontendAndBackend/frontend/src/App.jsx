import { useEffect, useState } from "react";
import "./App.css";
import axios from "axios";

function App() {
  const [jokes, setJokes] = useState([]);

  // we will get an CORS error in the console because the frontend is running on port 3001 and the backend is running on port 3000
  // CORS (Cross-Origin Resource Sharing) is a security feature implemented in browsers that restricts how a web application running on one origin can interact with resources from a different origin

  useEffect(() => {
    axios
      .get("/api/jokes")
      .then((response) => {
        setJokes(response.data);
      })
      .catch((error) => {
        console.error("Error fetching data: ", error);
      });
  }, []);
  return (
    <>
      <h1>Full stack application</h1>
      <p>Jokes : {jokes.length}</p>
      <ul>
        {jokes.map((joke) => (
          <li key={joke.id}>
            <h2>{joke.title}</h2>
            <p>{joke.content}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

export default App;
