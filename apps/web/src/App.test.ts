import { describe, expect, it } from "vitest";

import { matchActionState, matchActionStateKey, plural } from "./App";

describe("dashboard copy helpers", () => {
  it("uses singular and explicit irregular plural count labels", () => {
    expect(plural(1, "match", "matches")).toBe("match");
    expect(plural(2, "match", "matches")).toBe("matches");
    expect(plural(1, "event")).toBe("event");
    expect(plural(2, "event")).toBe("events");
  });

  it("resets the action note only when match action state changes", () => {
    const needsReview = matchActionState("needs_review");
    const onHold = matchActionState("on_hold");
    const onHoldKey = matchActionStateKey("match-1", "on_hold");
    const sameStatusRerenderKey = matchActionStateKey("match-1", "on_hold");

    expect(needsReview).toMatchObject({
      targetStatus: "on_hold",
      defaultNote: "Moved to the designated hold area for review.",
    });
    expect(onHold).toMatchObject({
      targetStatus: "resolved",
      defaultNote: "Review completed; item released from this demo hold.",
    });
    expect(matchActionStateKey("match-1", "needs_review")).not.toBe(onHoldKey);
    expect(sameStatusRerenderKey).toBe(onHoldKey);
    expect(matchActionStateKey("match-2", "on_hold")).not.toBe(onHoldKey);
  });
});
