import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

// app.get("/", (req, res) => {
//   res.json({ message: "Hello from server!" });
// });

// get a list of five jokes

app.get("/api/jokes", (req, res) => {
  const jokes = [
    {
      id: 1,
      title: "Why did the scarecrow win an award?",
      content: "Because he was outstanding in his field.",
    },
    {
      id: 2,
      title: "How do you make holy water?",
      content: "You boil the hell out of it.",
    },
    {
      id: 3,
      title: "What do you call someone with no body and no nose?",
      content: "Nobody knows.",
    },
    {
      id: 4,
      title: "What is the least spoken language in the world?",
      content: "Sign language",
    },
    {
      id: 5,
      title: "Why couldn't the bicycle stand up by itself?",
      content: "It was two tired.",
    },
  ];
  res.json(jokes);
});

app.listen(PORT, () => {
  console.log("Server is listening on port 3000");
});
