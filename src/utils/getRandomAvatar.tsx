import {
  faMusic,
  faHeadphones,
  faRadio,
  faVolumeHigh,
  faGuitar,
  faDrum,
  IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export const icons = {
  music: faMusic,
  headphones: faHeadphones,
  radio: faRadio,
  volume: faVolumeHigh,
  guitar: faGuitar,
  drum: faDrum,
};

export default function getRandomAvatar(excludeIcons?: string[]): {
  avatar: JSX.Element;
  iconName: string;
} {
  const availableIcons = { ...icons };

  excludeIcons?.forEach((icon) => {
    for (const key in availableIcons) {
      if (key === icon) {
        delete availableIcons[key as keyof typeof availableIcons];
      }
    }
  });

  const getRandomIcon = () => {
    const iconKeys = Object.keys(availableIcons);
    const randomKey = iconKeys[Math.floor(Math.random() * iconKeys.length)];
    return {
      icon: availableIcons[randomKey as keyof typeof availableIcons],
      name: randomKey,
    };
  };

  return {
    avatar: (
      <FontAwesomeIcon
        icon={getRandomIcon().icon}
        className="text-indigo-400"
      />
    ),
    iconName: getRandomIcon().name,
  };
}
