import { describe, it, expect } from "vitest";
import {
  recipeInputSchema,
  loginInputSchema,
  signupInputSchema,
  updateProfileSchema,
  changePasswordSchema,
  resetPasswordSchema,
  emailSchema,
} from "../schemas";

describe("schemas", () => {
  describe("recipeInputSchema", () => {
    const validRecipe = {
      recipe_name: "Test Recipe",
      description: "A test description",
      ingredients: [{ name: "Flour", measurement: "dl", quantity: "2" }],
      instructions: [{ step: "Mix everything" }],
    };

    it("should validate a valid recipe", () => {
      const result = recipeInputSchema.safeParse(validRecipe);
      expect(result.success).toBe(true);
    });

    it("should require recipe_name", () => {
      const result = recipeInputSchema.safeParse({
        ...validRecipe,
        recipe_name: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Receptnamn är obligatoriskt");
      }
    });

    it("should require description", () => {
      const result = recipeInputSchema.safeParse({
        ...validRecipe,
        description: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Beskrivning är obligatorisk");
      }
    });

    it("should require at least one ingredient", () => {
      const result = recipeInputSchema.safeParse({
        ...validRecipe,
        ingredients: [],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Minst en ingrediens måste anges");
      }
    });

    it("should require at least one instruction", () => {
      const result = recipeInputSchema.safeParse({
        ...validRecipe,
        instructions: [],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Minst en instruktion måste anges");
      }
    });

    it("should validate ingredient with group", () => {
      const result = recipeInputSchema.safeParse({
        ...validRecipe,
        ingredients: [
          { group: "Degen" },
          { name: "Mjöl", measurement: "dl", quantity: "2" },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("should require non-empty group name for ingredients", () => {
      const result = recipeInputSchema.safeParse({
        ...validRecipe,
        ingredients: [{ group: "" }],
      });
      expect(result.success).toBe(false);
    });

    it("should validate instruction with group", () => {
      const result = recipeInputSchema.safeParse({
        ...validRecipe,
        instructions: [{ group: "Förberedelse" }, { step: "Steg 1" }],
      });
      expect(result.success).toBe(true);
    });

    it("should validate URL if provided", () => {
      const result = recipeInputSchema.safeParse({
        ...validRecipe,
        url: "not-a-url",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Ogiltig URL");
      }
    });

    it("should allow valid URL", () => {
      const result = recipeInputSchema.safeParse({
        ...validRecipe,
        url: "https://example.com/recipe",
      });
      expect(result.success).toBe(true);
    });

    it("should allow empty string for URL", () => {
      const result = recipeInputSchema.safeParse({
        ...validRecipe,
        url: "",
      });
      expect(result.success).toBe(true);
    });

    it("should require non-negative prep_time", () => {
      const result = recipeInputSchema.safeParse({
        ...validRecipe,
        prep_time: -5,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Förberedelsetid kan inte vara negativ");
      }
    });

    it("should require integer prep_time", () => {
      const result = recipeInputSchema.safeParse({
        ...validRecipe,
        prep_time: 10.5,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Förberedelsetid måste vara ett heltal");
      }
    });
  });

  describe("loginInputSchema", () => {
    it("should validate valid login", () => {
      const result = loginInputSchema.safeParse({
        email: "test@example.com",
        password: "password123",
      });
      expect(result.success).toBe(true);
    });

    it("should require valid email", () => {
      const result = loginInputSchema.safeParse({
        email: "not-an-email",
        password: "password123",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Ogiltig e-postadress");
      }
    });

    it("should require password", () => {
      const result = loginInputSchema.safeParse({
        email: "test@example.com",
        password: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Lösenord är obligatoriskt");
      }
    });
  });

  describe("signupInputSchema", () => {
    it("should validate valid signup", () => {
      const result = signupInputSchema.safeParse({
        name: "John Doe",
        email: "john@example.com",
        password: "Password1",
      });
      expect(result.success).toBe(true);
    });

    it("should require name", () => {
      const result = signupInputSchema.safeParse({
        name: "",
        email: "john@example.com",
        password: "Password1",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Namn är obligatoriskt");
      }
    });

    it("should require minimum 8 character password", () => {
      const result = signupInputSchema.safeParse({
        name: "John",
        email: "john@example.com",
        password: "Pass1",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Lösenordet måste vara minst 8 tecken");
      }
    });

    it("should require uppercase letter in password", () => {
      const result = signupInputSchema.safeParse({
        name: "John",
        email: "john@example.com",
        password: "password1",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Lösenordet måste innehålla minst en versal");
      }
    });

    it("should require lowercase letter in password", () => {
      const result = signupInputSchema.safeParse({
        name: "John",
        email: "john@example.com",
        password: "PASSWORD1",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Lösenordet måste innehålla minst en gemen");
      }
    });

    it("should require digit in password", () => {
      const result = signupInputSchema.safeParse({
        name: "John",
        email: "john@example.com",
        password: "Passwordd",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Lösenordet måste innehålla minst en siffra");
      }
    });
  });

  describe("updateProfileSchema", () => {
    it("should validate valid profile update", () => {
      const result = updateProfileSchema.safeParse({
        name: "John Doe",
      });
      expect(result.success).toBe(true);
    });

    it("should require name", () => {
      const result = updateProfileSchema.safeParse({
        name: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Namn är obligatoriskt");
      }
    });
  });

  describe("changePasswordSchema", () => {
    it("should validate valid password change", () => {
      const result = changePasswordSchema.safeParse({
        oldPassword: "oldpassword",
        newPassword: "NewPassword1",
      });
      expect(result.success).toBe(true);
    });

    it("should require old password", () => {
      const result = changePasswordSchema.safeParse({
        oldPassword: "",
        newPassword: "NewPassword1",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Nuvarande lösenord är obligatoriskt");
      }
    });

    it("should validate new password requirements", () => {
      const result = changePasswordSchema.safeParse({
        oldPassword: "oldpassword",
        newPassword: "weak",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("resetPasswordSchema", () => {
    it("should validate valid password reset", () => {
      const result = resetPasswordSchema.safeParse({
        password: "NewPassword1",
        confirmPassword: "NewPassword1",
      });
      expect(result.success).toBe(true);
    });

    it("should require matching passwords", () => {
      const result = resetPasswordSchema.safeParse({
        password: "NewPassword1",
        confirmPassword: "DifferentPassword1",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Lösenorden matchar inte");
      }
    });

    it("should validate password requirements", () => {
      const result = resetPasswordSchema.safeParse({
        password: "weak",
        confirmPassword: "weak",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("emailSchema", () => {
    it("should validate valid email", () => {
      const result = emailSchema.safeParse({
        email: "test@example.com",
      });
      expect(result.success).toBe(true);
    });

    it("should require valid email format", () => {
      const result = emailSchema.safeParse({
        email: "not-an-email",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Ogiltig e-postadress");
      }
    });

    it("should trim email before validation", () => {
      const result = emailSchema.safeParse({
        email: "  test@example.com  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("test@example.com");
      }
    });
  });
});
