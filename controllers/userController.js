import userModel from "../models/userModel.js";
import Booking from "../models/Booking.js";

export const getUserData = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await userModel
      .findById(userId)
      .select("-password -verifyOtp -resetOtp"); // Exclude sensitive fields

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      userData: {
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
        isAccountVerified: user.isAccountVerified,
        wishlist: user.wishlist,
      },
    });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

// Get all providers for a specific service
// export const getProvidersByService = async (req, res) => {
//   const { service } = req.query;
//   if (!service)
//     return res.json({ success: false, message: "Service required" });
//   console.log(
//     "🔍 Searching providers offering service:",
//     JSON.stringify(service)
//   );

//   try {
//     const providers = await userModel
//       .find({
//         role: "provider",
//         isAccountVerified: true,
//         // "servicesOffered.services": service, // This matches any bundle containing the service
//         servicesOffered: {
//           $elemMatch: {
//             services: { $elemMatch: { $regex: `^${service}$`, $options: "i" } },
//           },
//         },
//       })
//       .select("-password -verifyOtp -resetOtp");

//     if (!providers || providers.length === 0) {
//       console.log(" No providers found for service ", JSON.stringify(service));
//     }

//     res.json({ success: true, providers });
//   } catch (error) {
//     res.json({ success: false, message: error.message });
//   }
// };
export const getProvidersByService = async (req, res) => {
  const { service } = req.query;
  if (!service)
    return res.json({ success: false, message: "Service required" });

  console.log("🔍 Searching providers offering service:", JSON.stringify(service));

  try {
    const providers = await userModel.find({
      role: "provider",
      isAccountVerified: true,
      servicesOffered: {
        $elemMatch: {
          services: { $elemMatch: { $regex: `^${service}$`, $options: "i" } },
        },
      },
    }).select("-password -verifyOtp -resetOtp");

    // Get average ratings for each provider
    const providersWithRatings = await Promise.all(
      providers.map(async (provider) => {
        const bookings = await Booking.find({
          provider: provider._id,
          "customerFeedback.rating": { $exists: true },
        }).select("customerFeedback.rating");

        const ratings = bookings.map((b) => b.customerFeedback.rating);
        const averageRating =
          ratings.length > 0
            ? ratings.reduce((acc, r) => acc + r, 0) / ratings.length
            : null;

        return {
          ...provider.toObject(),
          averageRating: averageRating ? averageRating.toFixed(1) : "N/A",
        };
      })
    );

    if (!providersWithRatings.length) {
      console.log("No providers found for service", JSON.stringify(service));
    }

    res.json({ success: true, providers: providersWithRatings });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};


// Get provider profile
export const getProviderProfile = async (req, res) => {
  try {
    const provider = await userModel
      .findById(req.query.id)
      .select("-password -verifyOtp -resetOtp");
    if (!provider)
      return res.json({ success: false, message: "Provider not found" });
    res.json({ success: true, provider });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Toggle wishlist
export const toggleWishlist = async (req, res) => {
  console.log("🔁 Toggle wishlist called"); // Add this

  try {
    const userId = req.user.id; // or req.user._id, depending on your auth middleware
    const { providerId } = req.body;

    if (!providerId) {
      return res.json({ success: false, message: "Provider ID required" });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const index = user.wishlist?.indexOf(providerId) ?? -1;
    let action;
    if (index === -1) {
      user.wishlist = user.wishlist || [];
      user.wishlist.push(providerId);
      action = "added";
    } else {
      user.wishlist.splice(index, 1);
      action = "removed";
    }
    try {
      await user.save({ validateBeforeSave: false });
      console.log("✅ Wishlist successfully saved");
    } catch (saveErr) {
      console.error("❌ Error saving user:", saveErr.message);
    }

    res.json({ success: true, action, wishlist: user.wishlist });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Fetch all bookings made by the logged-in customer
export const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ customer: req.user.id })
      .populate({ path: "provider", model: "user", select: "name avatarUrl" }) // ⭐ Add this
      .sort({
        createdAt: -1,
      });
    res.json({ success: true, bookings });
  } catch (err) {
    console.error("Error fetching my bookings:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Fetch all reviews of the provider
export const getProviderReviews = async (req, res) => {
  try {
    const reviews = await Booking.find({
      provider: req.params.providerId,
      "customerFeedback.rating": { $exists: true },
    })
      .populate({ path: "customer", model: "user", select: "name avatarUrl" })
      .select("customerFeedback customer")
      .sort({ "customerFeedback.date": -1 });

    res.json({ reviews });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
