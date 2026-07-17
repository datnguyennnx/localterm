import { SettingsSelect, type SettingsSelectItem } from "@/components/settings-select";
import { Field, FieldLabel } from "@/components/ui/field";
import { TERMINAL_THEMES } from "@/features/terminal/theme/terminal-themes";

const SECTION_LABEL_CLASSES =
  "text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase";

const THEME_ITEMS: readonly SettingsSelectItem[] = TERMINAL_THEMES.map((theme) => ({
  id: theme.id,
  label: theme.name,
}));

interface ThemeSectionProps {
  themeId: string;
  onThemeChange: (themeId: string | null) => void;
  onThemePreview?: (themeId: string | null) => void;
  onOpenChange?: (open: boolean) => void;
}

export const ThemeSection = ({
  themeId,
  onThemeChange,
  onThemePreview,
  onOpenChange,
}: ThemeSectionProps) => (
  <Field orientation="vertical" className="gap-1.5">
    <FieldLabel className={SECTION_LABEL_CLASSES}>Theme</FieldLabel>
    <SettingsSelect
      value={themeId}
      items={THEME_ITEMS}
      ariaLabel="select theme"
      placeholder="Theme"
      onValueChange={onThemeChange}
      onOpenChange={onOpenChange}
      onItemHover={onThemePreview}
    />
  </Field>
);
