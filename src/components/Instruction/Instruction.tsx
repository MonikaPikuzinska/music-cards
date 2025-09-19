import {
  faArrowRotateRight,
  faCompactDisc,
  faMusic,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";

export const instructionData = [
  {
    title: (
      <>
        <FontAwesomeIcon icon={faMusic} className="text-indigo-400" /> Game
        Setup
      </>
    ),
    steps: [
      "The game supports 4-6 players.",
      "Each player sees 6 songs from which they will choose during the game.",
      "First Master is a player that created the game.",
    ],
  },
  {
    title: (
      <>
        <FontAwesomeIcon icon={faCompactDisc} className="text-indigo-400" />{" "}
        Turn Structure
      </>
    ),
    subSections: [
      {
        subTitle: "Master’s Role",
        steps: [
          "The Master looks at the 6 songs.",
          "Secretly chooses 1 song.",
          "Gives a clue about the chosen song (word, phrase, lyric snippet, humming, rhythm, emotion, etc.).",
        ],
      },
      {
        subTitle: "Players’ Role (2 min. selection)",
        steps: [
          "Each other player has 2 minutes to select 1 song that best matches the Master’s clue.",
          "If a player does not choose within 2 minutes, a random song is selected automatically.",
        ],
      },
      {
        subTitle: "Display & Voting (2 min. voting)",
        steps: [
          "Selected songs are revealed.",
          "All players (except the Master) have 2 minutes to vote for the song they believe belongs to the Master.",
          "Players cannot vote for their own submitted song.",
          "After 2 minutes, votes are revealed.",
        ],
      },
      {
        subTitle: "Results",
        steps: [
          "Each user sees which song was submitted by whom.",
          "Scores are updated on the scoreboard.",
        ],
      },
      {
        subTitle: "Points",
        steps: [
          "If some guessed the Master’s song (but not all):",
          [
            "Master scores 3 points.",
            "Correct guessers score 3 points each.",
            "Players get +1 bonus point for each vote on their own song.",
          ],
          "If everyone or no one guessed the Master’s song:",
          ["Master scores 0 points.", "All other players score 2 points."],
        ],
      },
    ],
  },
  {
    title: (
      <>
        <FontAwesomeIcon
          icon={faArrowRotateRight}
          className="text-indigo-400"
        />{" "}
        End of Round
      </>
    ),
    steps: ["The role of Master passes alphabetically to the next player."],
  },
];

const renderSteps = (steps: (string | string[])[]) => (
  <ul className="list-disc list-inside space-y-1 mb-2">
    {steps.map((step, idx) =>
      Array.isArray(step) ? (
        <ul key={idx} className="list-circle list-inside ml-6 space-y-1">
          {step.map((subStep, subIdx) => (
            <li key={subIdx}>{subStep}</li>
          ))}
        </ul>
      ) : (
        <li key={idx}>{step}</li>
      )
    )}
  </ul>
);

const Instruction: React.FC = () => (
  <div className="max-w-2xl mx-auto p-6 text-gray-800">
    {instructionData.map((section, idx) => (
      <div
        key={
          typeof section.title === "string" ? section.title : `section-${idx}`
        }
        className="mb-8"
      >
        <h2 className="text-2xl font-bold mb-3">{section.title}</h2>
        {section.steps &&
          section.steps.length > 0 &&
          renderSteps(section.steps)}
        {section.subSections &&
          section.subSections.map((sub, subIdx) => (
            <div
              key={sub.subTitle || `subsection-${subIdx}`}
              className="mb-4 ml-4"
            >
              <h3 className="text-lg font-semibold mb-1">{sub.subTitle}</h3>
              {renderSteps(sub.steps)}
            </div>
          ))}
      </div>
    ))}
  </div>
);

export default Instruction;
