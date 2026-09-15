import { faSquare, faSquareCheck } from "@fortawesome/free-regular-svg-icons";
import { faMusic } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { memo, type HTMLAttributes } from "react";

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
  disabled?: boolean;
  badge?: string;
}

const SpotifyPlayer = ({
  link,
  isSelected,
  onSelect,
  disabled = false,
  badge,
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
  const iframeWidth = typeof width === "number" ? `${width}px` : width;
  const iframeHeight = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className={`m-2 flex shrink-0 flex-col items-center ${
        disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"
      }`}
      onClick={() => {
        if (!disabled) onSelect();
      }}
    >
      {badge ? (
        <span className="mb-1 text-xs font-semibold text-indigo-500">
          {badge}
        </span>
      ) : null}
      <div className="flex items-center">
        {" "}
        <FontAwesomeIcon
          icon={faMusic}
          className={`m-1 cursor-pointer fa-lg ${
            isSelected ? "text-indigo-400" : "text-gray-400"
          }`}
        />
        {isSelected ? (
          <FontAwesomeIcon
            icon={faSquareCheck}
            className="text-indigo-400 mb-1 cursor-pointer fa-lg"
          />
        ) : (
          <FontAwesomeIcon
            icon={faSquare}
            className="text-gray-400 fa-lg mb-1 cursor-pointer"
          />
        )}
        <FontAwesomeIcon
          icon={faMusic}
          className={`m-1 cursor-pointer fa-lg ${
            isSelected ? "text-indigo-400" : "text-gray-400"
          }`}
        />
      </div>
      <div
        className="overflow-hidden rounded-lg"
        style={{ width: iframeWidth, height: iframeHeight }}
      >
        <iframe
          title="Spotify Web Player"
          src={`https://open.spotify.com/embed${url.pathname}`}
          width={iframeWidth}
          height={iframeHeight}
          frameBorder={frameBorder}
          allow={allow}
          style={{
            borderRadius: 8,
            ...style,
          }}
          {...props}
        />
      </div>
    </div>
  );
};

export default memo(SpotifyPlayer, (prev, next) => {
  return (
    prev.link === next.link &&
    prev.isSelected === next.isSelected &&
    prev.disabled === next.disabled &&
    prev.badge === next.badge &&
    prev.wide === next.wide &&
    prev.width === next.width &&
    prev.height === next.height
  );
});
