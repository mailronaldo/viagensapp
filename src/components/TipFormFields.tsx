import { CategoryCheckboxes, Field, inputCls } from "@/components/ui";
import { NeighborhoodSelect } from "@/components/NeighborhoodSelect";

export function TipFormFields({
  neighborhoods,
  cities,
  categories,
  tip,
}: {
  neighborhoods: { id: string; name: string; cityId: string; cityName: string }[];
  cities: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  tip?: {
    name: string;
    description: string | null;
    neighborhoodId: string | null;
    categories?: { id: string; name: string }[];
  };
}) {
  return (
    <>
      <Field label="Nome" className="sm:col-span-4">
        <input name="name" required defaultValue={tip?.name} className={inputCls} />
      </Field>
      <Field label="Bairro/Região" className="sm:col-span-2">
        <NeighborhoodSelect neighborhoods={neighborhoods} cities={cities} defaultValue={tip?.neighborhoodId ?? ""} required />
      </Field>
      <Field label="Categorias" className="sm:col-span-6">
        <CategoryCheckboxes categories={categories} defaultSelected={tip?.categories?.map((c) => c.id)} />
      </Field>
      <Field label="Descrição" className="sm:col-span-6">
        <textarea name="description" rows={2} defaultValue={tip?.description ?? ""} className={inputCls} />
      </Field>
    </>
  );
}
