import { describe, expect, it } from "vitest";
import { revisionFeeDeltaPresentation } from "@/lib/revisionFeeDelta";

describe("revision fee delta presentation", () => {
  it.each([
    {
      value: 560,
      tone: "increase",
      label: "増額 +560円",
      ariaLabel: "前年度から560円増額"
    },
    {
      value: -340,
      tone: "decrease",
      label: "減額 -340円",
      ariaLabel: "前年度から340円減額"
    },
    {
      value: 0,
      tone: "unchanged",
      label: "料金差額なし 0円",
      ariaLabel: "前年度から料金の差額はありません"
    },
    {
      value: null,
      tone: "unavailable",
      label: "差額算定不可",
      ariaLabel: "前年度との差額は算定できません"
    }
  ])("shows $tone with text as well as color", ({ value, tone, label, ariaLabel }) => {
    expect(revisionFeeDeltaPresentation(value)).toEqual({ tone, label, ariaLabel });
  });

  it("treats non-finite values as unavailable", () => {
    expect(revisionFeeDeltaPresentation(Number.NaN).tone).toBe("unavailable");
    expect(revisionFeeDeltaPresentation(Number.POSITIVE_INFINITY).tone).toBe("unavailable");
  });
});
