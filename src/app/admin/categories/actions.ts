"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  createPromptCategory,
  setPromptCategoryActive,
  updatePromptCategory
} from "@/lib/categories";
import { redirectWithError, redirectWithQuery, rethrowIfNextNavigation } from "@/lib/form-action";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }
  if (user.role !== "admin") {
    redirectWithError("/admin", "Admin access is required.");
  }
  return user;
}

function revalidateCategoryPaths() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/prompts");
  revalidatePath("/admin/acts");
  revalidatePath("/prompts");
  revalidatePath("/log");
}

export async function createCategoryAction(formData: FormData) {
  try {
    await requireAdmin();
    const name = readText(formData, "name");
    if (!name) {
      redirectWithError("/admin/categories", "Tag name is required.");
    }
    const sortOrderRaw = readText(formData, "sort_order");
    const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : undefined;

    await createPromptCategory({
      name,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : undefined
    });

    revalidateCategoryPaths();
    redirectWithQuery("/admin/categories", { saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/categories", error, "Could not create tag.");
  }
}

export async function updateCategoryAction(formData: FormData) {
  try {
    await requireAdmin();
    const id = readText(formData, "id");
    const name = readText(formData, "name");
    const sortOrder = Number(readText(formData, "sort_order") || "0");
    const isActive = formData.get("is_active") === "on";

    if (!id) {
      redirectWithError("/admin/categories", "Tag id is required.");
    }
    if (!name) {
      redirectWithError("/admin/categories", "Tag name is required.");
    }

    await updatePromptCategory({
      id,
      name,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      isActive
    });

    revalidateCategoryPaths();
    redirectWithQuery("/admin/categories", { saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/categories", error, "Could not update tag.");
  }
}

export async function setCategoryStatusAction(formData: FormData) {
  try {
    await requireAdmin();
    const id = readText(formData, "id");
    const isActive = readText(formData, "is_active") === "true";

    if (!id) {
      redirectWithError("/admin/categories", "Tag id is required.");
    }

    await setPromptCategoryActive({ id, isActive });
    revalidateCategoryPaths();
    redirectWithQuery("/admin/categories", { saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/categories", error, "Could not update tag status.");
  }
}
