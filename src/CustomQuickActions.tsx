import {
  DefaultQuickActions,
  DefaultQuickActionsContent,
  TldrawUiMenuItem,
  useActions,
  TLUiActionsContextType,
} from "tldraw";

export function CustomQuickActions({
  currentStep,
  maxStep,
  isPresentationEditModeActive,
  maxPresentationGroupId,
}: {
  currentStep: number;
  maxStep: number;
  isPresentationEditModeActive: boolean;
  maxPresentationGroupId: number;
}) {
  const actions = useActions();
  const transformedActions = transformActionForMenuItem(actions);

  return (
    <DefaultQuickActions>
      <DefaultQuickActionsContent />
      {transformedActions["presentation-edit"] && (
        <>
          {isPresentationEditModeActive ? (
            <div
              style={{
                alignItems: "center",
                backgroundColor: "rgb(216, 219, 219)",
                borderRadius: "4px",
                display: "flex",
                gap: "2px",
                paddingRight: "6px",
              }}
            >
              <TldrawUiMenuItem {...transformedActions["presentation-edit"]} />
              <span
                aria-label={`Highest presentation order: ${maxPresentationGroupId}`}
                data-testid="presentation-max-group-id"
                style={{
                  alignItems: "center",
                  backgroundColor: "#ffffff",
                  border: "1px solid rgba(15, 23, 42, 0.14)",
                  borderRadius: "999px",
                  color: "#111827",
                  display: "inline-flex",
                  fontSize: "11px",
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 700,
                  height: "20px",
                  justifyContent: "center",
                  lineHeight: 1,
                  minWidth: "24px",
                  padding: "0 7px",
                  pointerEvents: "none",
                }}
              >
                {maxPresentationGroupId}
              </span>
            </div>
          ) : (
            <TldrawUiMenuItem {...transformedActions["presentation-edit"]} />
          )}
        </>
      )}
      {transformedActions["presentation"] && <TldrawUiMenuItem {...transformedActions["presentation"]} />}
      {transformedActions["presentation-first"] && (
        <TldrawUiMenuItem {...transformedActions["presentation-first"]} disabled={currentStep === 0} />
      )}
      {transformedActions["presentation-left"] && (
        <TldrawUiMenuItem {...transformedActions["presentation-left"]} disabled={currentStep === 0} />
      )}
      {transformedActions["presentation-right"] && (
        <TldrawUiMenuItem {...transformedActions["presentation-right"]} disabled={currentStep === maxStep} />
      )}
      {transformedActions["presentation-last"] && (
        <TldrawUiMenuItem {...transformedActions["presentation-last"]} disabled={currentStep === maxStep} />
      )}
    </DefaultQuickActions>
  );
}

function transformActionForMenuItem(actions: TLUiActionsContextType) {
  return Object.fromEntries(
    Object.entries(actions).map(([key, action]) => [
      key,
      {
        ...action,
        icon: action.icon as string,
      },
    ]),
  );
}
