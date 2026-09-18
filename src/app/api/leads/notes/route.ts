import { created, withApi } from "@/lib/api/with-api";
import { addNoteSchema } from "@/features/pipeline/schemas";
import { addNote } from "@/features/pipeline/service";

/** POST /api/leads/notes — appends a note to a lead. */
export const POST = withApi(
  async ({ ctx, body }) => {
    const note = await addNote(ctx, body);
    return created(note);
  },
  { body: addNoteSchema },
);
