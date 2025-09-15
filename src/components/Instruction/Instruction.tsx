import React from "react";

export const instructionData = [
  {
    title: "🎤 Game Setup",
    steps: [
      "Each player chooses a color and takes a matching voting dial and pawn.",
      "Place pawns on the starting space of the scoring track.",
      "Shuffle all songs (or song prompts) and deal 6 songs face down to each player.",
      "Make a draw pile with the remaining songs.",
      "Select the first Master (the player whose name comes first alphabetically).",
    ],
  },
  {
    title: "🎼 Turn Structure",
    subSections: [
      {
        subTitle: "Master’s Role",
        steps: [
          "The Master looks at their hand of 6 songs.",
          "Secretly chooses 1 song.",
          "Gives a clue about the chosen song (word, phrase, lyric snippet, humming, rhythm, emotion, etc.).",
        ],
      },
      {
        subTitle: "Players’ Role (2 min. selection)",
        steps: [
          "Each other player has 2 minutes to select 1 song from their hand that best matches the Master’s clue.",
          "If a player does not choose within 2 minutes, a random song from their hand is selected automatically.",
          "Players secretly give their chosen song to the Master.",
        ],
      },
      {
        subTitle: "Display & Voting (2 min. voting)",
        steps: [
          "The Master shuffles all selected songs (including their own).",
          "Songs are revealed face up in numbered slots.",
          "All players (except the Master) have 2 minutes to vote using their dials for the song they believe belongs to the Master.",
          "Players cannot vote for their own submitted song.",
          "After 2 minutes, votes are revealed.",
        ],
      },
      {
        subTitle: "Results & Points",
        steps: [
          "Each user sees which song was submitted by whom.",
          "Scores are updated on the scoreboard:",
          "If some guessed the Master’s song (but not all):",
          "Master scores 3 points.",
          "Correct guessers score 3 points each.",
          "Players get +1 bonus point for each vote on their own song.",
          "If everyone or no one guessed the Master’s song:",
          "Master scores 0 points.",
          "All other players score 2 points.",
        ],
      },
    ],
  },
  {
    title: "🔄 End of Round",
    steps: [
      "Discard all used songs.",
      "Each player draws back up to 6 songs.",
      "The role of Master passes alphabetically to the next player.",
    ],
  },
  {
    title: "🏁 End of Game",
    steps: [
      "The game ends when a player reaches or exceeds 30 points.",
      "The player with the most points wins.",
      "In case of a tie, tied players share the victory.",
    ],
  },
];

const Instruction: React.FC = () => (
  <div className="max-w-2xl mx-auto p-6 text-gray-800">
    {instructionData.map((section) => (
      <div key={section.title} className="mb-8">
        <h2 className="text-2xl font-bold mb-3">{section.title}</h2>
        {section.steps && section.steps.length > 0 && (
          <ul className="list-disc list-inside space-y-1 mb-2">
            {section.steps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ul>
        )}
        {section.subSections &&
          section.subSections.map((sub) => (
            <div key={sub.subTitle} className="mb-4 ml-4">
              <h3 className="text-lg font-semibold mb-1">{sub.subTitle}</h3>
              <ul className="list-disc list-inside space-y-1">
                {sub.steps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    ))}
  </div>
);

export default Instruction;
