interface ReleaseTagsProps {
  tags: string[];
}

export const ReleaseTags = ({ tags }: ReleaseTagsProps) => {
  if (tags.length === 0) return null;

  return (
    <ul aria-label="Topics" className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li key={tag} className="bg-card text-muted rounded-full px-3 py-1 text-sm">
          {tag}
        </li>
      ))}
    </ul>
  );
};

export default ReleaseTags;
