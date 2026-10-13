import { describe, expect, it } from "vitest";
import { DEMO_ENVIRONMENTS } from "@/lib/demo-environments";
import {
  acknowledgeProduction,
  allowanceAdmitsOneMore,
  clearDemoVisit,
  createDemoVisitState,
  isScopeValidated,
  isSelectionCurrent,
  markScopeValidated,
  remainingAllowance,
  requiresProductionAcknowledgement,
  sandboxAllowanceFrom,
  setApiKey,
  setEnvironment,
  type DemoVisitState,
} from "@/app/demo/demo-session-state";

const KEY = "aihub_sandbox_" + "A".repeat(43);

/** One Production visit that has already had its key validated and acknowledged. */
function validated(): DemoVisitState {
  return acknowledgeProduction(
    markScopeValidated(
      setApiKey(setEnvironment(createDemoVisitState(), "production"), KEY),
      "writing.grade"
    )
  );
}

describe("Demo visit", () => {
  it("starts on Sandbox with no key and no acknowledgement", () => {
    const state = createDemoVisitState();

    expect(state).toEqual({
      apiKey: "",
      environment: "sandbox",
      validatedScopes: [],
      productionAcknowledged: false,
      generation: 0,
    });
    expect(DEMO_ENVIRONMENTS[0]).toBe("sandbox");
    expect(requiresProductionAcknowledgement(state)).toBe(false);
  });
});

describe("Changing the key", () => {
  it("drops the validation and the Production acknowledgement it was given for", () => {
    const next = setApiKey(validated(), "aihub_prod_" + "B".repeat(43));

    expect(isScopeValidated(next, "writing.grade")).toBe(false);
    expect(requiresProductionAcknowledgement(next)).toBe(true);
  });

  it("keeps the visit as it was when the value did not actually change", () => {
    const before = validated();

    expect(setApiKey(before, KEY)).toBe(before);
  });
});

describe("Changing the environment", () => {
  it("drops the validation and the Production acknowledgement", () => {
    const next = setEnvironment(validated(), "sandbox");

    expect(isScopeValidated(next, "writing.grade")).toBe(false);
    expect(requiresProductionAcknowledgement(next)).toBe(false);
  });

  it("keeps the visit as it was when the selection did not actually change", () => {
    const before = validated();

    expect(setEnvironment(before, "production")).toBe(before);
  });
});

describe("A late validation response", () => {
  it("cannot unlock the key it was sent for once the key has changed", () => {
    const submitted = { apiKey: KEY, environment: "sandbox" } as const;
    const before = validated();
    const changed = setApiKey(before, "aihub_prod_" + "C".repeat(43));

    expect(
      isSelectionCurrent(
        changed,
        submitted.apiKey,
        submitted.environment,
        before.generation
      )
    ).toBe(false);
  });

  it("cannot unlock the environment it was sent for once the selection has changed", () => {
    const before = setApiKey(createDemoVisitState(), KEY);
    const changed = setEnvironment(before, "production");

    expect(isSelectionCurrent(changed, KEY, "sandbox", before.generation)).toBe(
      false
    );
  });

  it("cannot unlock a selection the visitor left and came back to (A, B, A)", () => {
    const sent = setApiKey(createDemoVisitState(), KEY);
    const back = setEnvironment(setEnvironment(sent, "production"), "sandbox");

    expect(back.environment).toBe(sent.environment);
    expect(isSelectionCurrent(back, KEY, "sandbox", sent.generation)).toBe(
      false
    );
  });

  it("still applies when neither has changed", () => {
    const state = setApiKey(createDemoVisitState(), `  ${KEY}  `);

    expect(isSelectionCurrent(state, KEY, "sandbox", state.generation)).toBe(
      true
    );
  });
});

describe("Production acknowledgement", () => {
  it("is required before the first Production grade of a visit", () => {
    const state = setEnvironment(createDemoVisitState(), "production");

    expect(requiresProductionAcknowledgement(state)).toBe(true);
    expect(
      requiresProductionAcknowledgement(acknowledgeProduction(state))
    ).toBe(false);
  });

  it("does not block a Sandbox grade", () => {
    expect(
      requiresProductionAcknowledgement(setApiKey(createDemoVisitState(), KEY))
    ).toBe(false);
  });
});

describe("Leaving the demo", () => {
  it("clears the key, the validation and the acknowledgement", () => {
    const before = validated();
    const cleared = clearDemoVisit(before);

    expect({ ...cleared, generation: 0 }).toEqual(createDemoVisitState());
    expect(cleared.generation).toBeGreaterThan(before.generation);
  });
});

describe("The Sandbox allowance snapshot", () => {
  const valid = {
    data: {
      valid: true,
      environment: "sandbox",
      scope: "writing.grade",
      allowance: {
        monthly_limit: 5,
        reserved: 2,
        shared_monthly_limit: 500,
        shared_reserved: 12,
      },
    },
  };

  it("reads the counts out of a validation response", () => {
    expect(sandboxAllowanceFrom(valid)).toEqual({
      monthlyLimit: 5,
      reserved: 2,
      sharedMonthlyLimit: 500,
      sharedReserved: 12,
    });
    expect(
      remainingAllowance({
        monthlyLimit: 5,
        reserved: 2,
        sharedMonthlyLimit: 500,
        sharedReserved: 12,
      })
    ).toBe(3);
  });

  it("reports no snapshot where the backend reports none", () => {
    expect(
      sandboxAllowanceFrom({
        data: {
          valid: true,
          environment: "sandbox",
          scope: "writing.grade",
          allowance: null,
        },
      })
    ).toBeNull();
  });

  it("treats a snapshot it cannot read as no snapshot", () => {
    expect(
      sandboxAllowanceFrom({
        data: {
          valid: true,
          allowance: {
            monthly_limit: "five",
            reserved: 0,
            shared_monthly_limit: 500,
            shared_reserved: 0,
          },
        },
      })
    ).toBeNull();
  });

  it("rejects counts outside the safe range and snapshots for another environment", () => {
    for (const monthly_limit of [
      -1,
      1.5,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(
        sandboxAllowanceFrom({
          ...valid,
          data: {
            ...valid.data,
            allowance: { ...valid.data.allowance, monthly_limit },
          },
        })
      ).toBeNull();
    }
    expect(
      sandboxAllowanceFrom({
        ...valid,
        data: { ...valid.data, environment: "production" },
      })
    ).toBeNull();
    expect(
      sandboxAllowanceFrom({
        ...valid,
        data: { ...valid.data, valid: false },
      })
    ).toBeNull();
  });

  it("does not show an exhausted Organization as available", () => {
    const exhaustedOrganization = {
      monthlyLimit: 5,
      reserved: 5,
      sharedMonthlyLimit: 500,
      sharedReserved: 0,
    };
    expect(allowanceAdmitsOneMore(exhaustedOrganization)).toBe(false);
    expect(
      allowanceAdmitsOneMore({
        ...exhaustedOrganization,
        reserved: 4,
      })
    ).toBe(true);
    expect(
      allowanceAdmitsOneMore({
        ...exhaustedOrganization,
        reserved: 0,
        sharedReserved: 500,
      })
    ).toBe(false);
  });

  it("does not claim availability when the policy could not be read", () => {
    expect(allowanceAdmitsOneMore(null)).toBeNull();
  });
});
