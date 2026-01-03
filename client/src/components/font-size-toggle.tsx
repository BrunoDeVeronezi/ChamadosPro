import { Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFontSize, FontSize } from "@/lib/font-size-provider";

export function FontSizeToggle() {
  const { fontSize, setFontSize } = useFontSize();

  const options: { label: string; value: FontSize }[] = [
    { label: "Pequeno (90%)", value: "small" },
    { label: "Padrão (100%)", value: "default" },
    { label: "Grande (108%)", value: "large" },
    { label: "Muito Grande (116%)", value: "xlarge" },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="Tamanho da Fonte"
          className="h-9 w-9 rounded-xl"
        >
          <Type className="h-5 w-5" />
          <span className="sr-only">Alterar tamanho da fonte</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border-slate-200 dark:border-slate-800">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setFontSize(option.value)}
            className={`cursor-pointer py-2.5 ${
              fontSize === option.value ? "bg-primary/10 text-primary font-semibold" : ""
            }`}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}




