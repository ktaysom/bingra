type AcceptedEventInput = {
  eventKey: string;
  eventLabel: string;
  pointValue: number;
  team?: "A" | "B" | null;
  teamKey?: "A" | "B" | null;
  threshold?: number;
  orderIndex?: number;
};

export function buildCardCellsPayload(input: {
  cardId: string;
  acceptedEvents: AcceptedEventInput[];
  lockEventKey?: string | null;
}): Array<{
  card_id: string;
  event_key: string;
  event_label: string;
  team_key: "A" | "B" | null;
  point_value: number;
  threshold: number;
  order_index: number;
  is_lock: boolean;
}> {
  const { cardId, acceptedEvents, lockEventKey } = input;

  return acceptedEvents.map((event, index) => ({
    card_id: cardId,
    event_key: event.eventKey,
    event_label: event.eventLabel,
    team_key: event.team ?? event.teamKey ?? null,
    point_value: event.pointValue,
    threshold:
      typeof event.threshold === "number" && Number.isFinite(event.threshold) && event.threshold > 0
        ? event.threshold
        : 1,
    order_index: event.orderIndex ?? index,
    is_lock: lockEventKey ? event.eventKey === lockEventKey : false,
  }));
}
