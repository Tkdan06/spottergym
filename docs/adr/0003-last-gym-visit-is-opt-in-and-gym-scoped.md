# 0003 — Last gym visit is opt-in and scoped to the viewed gym

## Decision

Show a card's last gym visit only when its owner enables `lastGymVisitVisible` (default `false`). Derive it from `CheckIn.checkedInAt` for the gym whose people list is being viewed.

## Consequences

- Do not use `lastSeenAt`, workouts, or activity inferred from another source.
- Do not disclose a visit in another gym, including when the viewer browses a club that is not their home gym.
- A current check-in remains `В зале`; it does not also show a prior-visit timestamp.
- Anonymous profiles never receive the timestamp, even if the setting was previously enabled.
- The API query and serializer both enforce the gym scope.
