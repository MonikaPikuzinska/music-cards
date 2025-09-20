import { faSquare, faSquareCheck } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { type HTMLAttributes } from "react";

interface SpotifyProps extends HTMLAttributes<HTMLIFrameElement> {
  [key: string]: any;

  link: string;
  wide?: boolean;
  width?: number | string;
  height?: number | string;
  frameBorder?: number | string;
  allow?: string;
  isSelected: boolean;
  onSelect: () => void;
}

const SpotifyPlayer = ({
  link,
  isSelected,
  onSelect,
  style = {},
  wide = false,
  width = wide ? "100%" : 300,
  height = wide ? 80 : 380,
  frameBorder = 0,
  allow = "encrypted-media",
  ...props
}: SpotifyProps) => {
  const url = new URL(link);
  // https://open.spotify.com/track/1KFxcj3MZrpBGiGA8ZWriv?si=f024c3aa52294aa1
  // Remove any additional path segments
  url.pathname = url.pathname.replace(/\/intl-\w+\//, "/");
  return (
    <div
      className="m-2 flex flex-col items-center cursor-pointer"
      onClick={onSelect}
    >
      {isSelected ? (
        <FontAwesomeIcon
          icon={faSquareCheck}
          className="text-indigo-400 mb-1 cursor-pointer fa-lg"
        />
      ) : (
        <FontAwesomeIcon
          icon={faSquare}
          className="text-indigo-400 fa-lg mb-1 cursor-pointer"
        />
      )}
      <iframe
        title="Spotify Web Player"
        src={`https://open.spotify.com/embed${url.pathname}`}
        width={`${width}px`}
        height={`${height}px`}
        frameBorder={frameBorder}
        allow={allow}
        style={{
          borderRadius: 8,
          ...style,
        }}
        {...props}
      />
    </div>
  );
};
export default SpotifyPlayer;
