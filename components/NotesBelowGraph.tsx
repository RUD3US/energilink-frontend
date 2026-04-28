import React from "react";
import { Pressable, Text, View } from "react-native";

export type NoteCard = {
  id: number;
  time: string;
  text: string;
  valueAtNote: number | null;
};

function formatNoteTime(time: string) {
  const d = new Date(time);

  if (Number.isNaN(d.getTime())) {
    return time;
  }

  return d.toLocaleString();
}

export function NotesBelowGraph({
  notes,
  selectedNoteId,
  onSelectNoteId,
  onClear,
  valueLabel = "Value at note",
  unit = "",
  decimals = 2,
  canDelete = false,
  onDelete,
}: {
  notes: NoteCard[];
  selectedNoteId: number | null;
  onSelectNoteId: (id: number) => void;
  onClear: () => void;
  valueLabel?: string;
  unit?: string;
  decimals?: number;
  canDelete?: boolean;
  onDelete?: (id: number) => void;
}) {
  return (
    <View
      style={{
        marginTop: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: "#eee",
        borderRadius: 12,
        backgroundColor: "#fff",
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "700" }}>
        Notes (below graph)
      </Text>

      <Text style={{ color: "#777", marginTop: 6 }}>
        Click a note line on the graph or a note item below to select.
      </Text>

      {notes.length === 0 ? (
        <Text style={{ color: "#777", marginTop: 10 }}>
          No notes in this chart window.
        </Text>
      ) : (
        <View style={{ marginTop: 10, gap: 8 }}>
          {notes.map((n) => {
            const selected = n.id === selectedNoteId;

            return (
              <View
                key={n.id}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: selected ? "#f59e0b" : "#eee",
                  backgroundColor: selected ? "rgba(245,158,11,0.10)" : "#fff",
                  gap: 8,
                }}
              >
                <Pressable onPress={() => onSelectNoteId(n.id)}>
                  <Text style={{ fontWeight: "700" }}>
                    {formatNoteTime(n.time)}
                  </Text>

                  <Text style={{ marginTop: 4 }}>{n.text}</Text>

                  <Text style={{ marginTop: 6, color: "#555" }}>
                    {valueLabel}:{" "}
                    {typeof n.valueAtNote === "number"
                      ? `${n.valueAtNote.toFixed(decimals)}${unit ? ` ${unit}` : ""}`
                      : "N/A"}
                  </Text>
                </Pressable>

                {canDelete && onDelete ? (
                  <Pressable
                    onPress={() => onDelete(n.id)}
                    style={{
                      alignSelf: "flex-start",
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: "#dc2626",
                      backgroundColor: "#fff",
                    }}
                  >
                    <Text style={{ color: "#dc2626", fontWeight: "700" }}>
                      Delete
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <Pressable
        onPress={onClear}
        style={{
          marginTop: 10,
          padding: 10,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "#ddd",
        }}
      >
        <Text>Clear selection</Text>
      </Pressable>
    </View>
  );
}
