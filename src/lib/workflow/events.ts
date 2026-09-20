/** TSD-события workflow (config.event в StatusTrigger). */
export const TSD_WORKFLOW_EVENTS = {
  inbound: {
    receive: "receive.complete",
    place: "putaway.complete",
  },
  outbound: {
    pick: "pick.complete",
  },
  operation: {
    complete: "operation.complete",
  },
} as const;
