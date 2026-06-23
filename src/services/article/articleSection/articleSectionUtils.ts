// Re-export from the central helper so callers don't need two imports
export { normalizeFeaturedImage } from "@/lib/helper-article";

/**
 * Returns the aggregation stages needed to populate `featuredImage` URL from the
 * `media` collection. Must be inserted AFTER the article has been unwound into
 * `articleArr` (the field name used in section pipelines).
 *
 * Produces `articleArr.featuredImageMedia` — consumed by `normalizeFeaturedImage`.
 */
export function featuredImageLookupStages(): object[] {
  return [
    {
      $lookup: {
        from: "media",
        let: {
          fiId: {
            $cond: {
              // Old ref-schema: featuredImage IS the ObjectId
              if: { $eq: [{ $type: "$articleArr.featuredImage" }, "objectId"] },
              then: "$articleArr.featuredImage",
              else: {
                $cond: {
                  // New/old-embedded schema: extract mediaId / _id sub-field
                  if: {
                    $eq: [{ $type: "$articleArr.featuredImage" }, "object"],
                  },
                  then: {
                    $ifNull: [
                      "$articleArr.featuredImage.mediaId",
                      "$articleArr.featuredImage._id",
                    ],
                  },
                  else: null,
                },
              },
            },
          },
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $ne: ["$$fiId", null] },
                  { $eq: ["$_id", "$$fiId"] },
                ],
              },
            },
          },
          { $project: { _id: 1, url: 1, caption: 1, credit: 1, takenBy: 1 } },
        ],
        as: "fiMediaArr",
      },
    },
    {
      $addFields: {
        "articleArr.featuredImageMedia": {
          $arrayElemAt: ["$fiMediaArr", 0],
        },
      },
    },
  ];
}
