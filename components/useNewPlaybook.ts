"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addPlaybook } from "@/lib/actions";
import { useAsyncAction } from "@/lib/hooks";
import { parsePrice } from "@/lib/stockUtils";
import { EMPTY_CONDITION } from "./StepFields";

// Form state for creating a playbook with its first step; on success it opens the new playbook.
export function useNewPlaybook(userEmail: string) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [firstStep, setFirstStep] = useState(EMPTY_CONDITION);
  const save = useAsyncAction();

  const price = parsePrice(firstStep.price);
  const canSave = name.trim() !== "" && firstStep.stock.trim() !== "" && price !== null;

  function reset() {
    setName("");
    setDescription("");
    setFirstStep(EMPTY_CONDITION);
    save.setError(null);
  }

  function create() {
    if (price === null) return Promise.resolve(false);
    return save.run(async () => {
      const playbook = await addPlaybook(
        { name, description, email: userEmail },
        { stock: firstStep.stock, operator: firstStep.operator, price },
      );
      router.push(`/playbooks/${playbook.id}`);
    });
  }

  return { name, setName, description, setDescription, firstStep, setFirstStep, canSave, reset, create, save };
}
