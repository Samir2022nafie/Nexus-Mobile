import { Community } from '../types';

type Listener = (community: Community) => void;
let listener: Listener | null = null;

export const setCommunitySelectionListener = (l: Listener | null) => {
  listener = l;
};

export const notifyCommunitySelected = (community: Community) => {
  if (listener) {
    listener(community);
  }
};
